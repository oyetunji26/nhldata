/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import ExcelJS from "exceljs";

/* -------------------- UTILS -------------------- */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Returns the START YEAR of the current NHL season
 * e.g. Jan 2025 → 2024 (2024–2025)
 * e.g. Nov 2025 → 2025 (2025–2026)
 */
function getCurrentNHLSeasonStartYear(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // Jan = 0

  return month >= 9 ? year : year - 1;
}

/**
 * duration = number of seasons (inclusive)
 * duration = 7 → 2019–2020 → 2025–2026
 */
function generateSeasonRange(duration: number): string[] {
  const currentStartYear = getCurrentNHLSeasonStartYear();
  const startYear = currentStartYear - (duration - 1);

  return Array.from({ length: duration }, (_, i) => {
    const y = startYear + i;
    return `${y}${y + 1}`;
  });
}

/* -------------------- AGGREGATES -------------------- */
async function fetchStats(type: "skater" | "goalie", season: string) {
  const sortParam = type === "goalie" ? "wins" : "skaterFullName";
  const url = `https://api.nhle.com/stats/rest/en/${type}/summary?isAggregate=false&isGame=false&sort=${sortParam}&start=0&limit=-1&cayenneExp=seasonId=${season}%20and%20gameTypeId=2`;

  const res = await axios.get(url);
  return res.data.data || [];
}

/* -------------------- GAME LOGS -------------------- */
async function fetchGameLogs(playerId: number, season: string) {
  try {
    const url = `https://api-web.nhle.com/v1/player/${playerId}/game-log/${season}/2`;
    const res = await axios.get(url);
    return res.data.gameLog || [];
  } catch {
    return [];
  }
}

/**
 * Parallel + batched log fetching
 * Safe for serverless
 */
async function fetchAllLogsParallel(
  playerId: number,
  seasons: string[],
  batchSize = 3
) {
  const logs: any[] = [];

  for (let i = 0; i < seasons.length; i += batchSize) {
    const batch = seasons.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map((s) => fetchGameLogs(playerId, s))
    );

    results.forEach((r) => {
      if (r.status === "fulfilled") {
        logs.push(...r.value);
      }
    });

    await sleep(75);
  }

  return logs;
}

/* -------------------- ROUTE -------------------- */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const duration = Math.max(
      1,
      Math.min(parseInt(searchParams.get("duration") || "7", 10), 10)
    );

    const threshold = parseFloat(searchParams.get("threshold") || "0.5");

    /* -------- SEASONS (THIS IS THE CORE FIX) -------- */
    const seasons = generateSeasonRange(duration);

    /* -------- FETCH AGGREGATES -------- */
    const skaters: any[] = [];
    const goalies: any[] = [];

    for (const season of seasons) {
      const [s, g] = await Promise.all([
        fetchStats("skater", season),
        fetchStats("goalie", season),
      ]);

      skaters.push(...s);
      goalies.push(...g);
      await sleep(100);
    }

    /* -------- PICK PLAYERS -------- */
    const playersToProcess = [
      ...skaters.slice(0, 60).map((p) => ({ ...p, type: "Skater" })),
      ...goalies.slice(0, 15).map((g) => ({ ...g, type: "Goalie" })),
    ];

    const finalRows: any[] = [];

    /* -------- PROCESS PLAYERS -------- */
    for (const p of playersToProcess) {
      const logs = await fetchAllLogsParallel(p.playerId, seasons);

      logs.sort(
        (a, b) =>
          new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()
      );

      let adv = {
        l5: "0.00",
        l10: "0.00",
        hitRate: "0%",
        lastOpp: "N/A",
        lastDate: "N/A",
        lastToi: "N/A",
      };

      if (logs.length) {
        const statKey = p.type === "Skater" ? "points" : "saves";

        const avg = (arr: any[]) =>
          arr.reduce((s, g) => s + (g[statKey] || 0), 0) / arr.length;

        const l5 = logs.slice(0, 5);
        const l10 = logs.slice(0, 10);

        const hits = logs.filter((g) => (g[statKey] || 0) >= threshold).length;

        adv = {
          l5: avg(l5).toFixed(2),
          l10: avg(l10).toFixed(2),
          hitRate: ((hits / logs.length) * 100).toFixed(1) + "%",
          lastOpp: logs[0].opponentAbbrev,
          lastDate: logs[0].gameDate,
          lastToi: logs[0].toi || "N/A",
        };
      }

      finalRows.push({
        name: p.type === "Skater" ? p.skaterFullName : p.goalieFullName,
        team: p.teamAbbrev,
        pos: p.type === "Skater" ? p.positionCode : "G",
        type: p.type,
        goals: p.goals || 0,
        points: p.points || 0,
        shots: p.shots || 0,
        saves: p.saves || 0,
        avg: (p.type === "Skater"
          ? p.points / p.gamesPlayed
          : p.saves / p.gamesPlayed
        ).toFixed(2),
        ...adv,
      });
    }

    /* -------- EXCEL -------- */
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("NHL Stats");

    sheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Team", key: "team", width: 8 },
      { header: "Pos", key: "pos", width: 6 },
      { header: "Type", key: "type", width: 10 },
      { header: "Goals", key: "goals", width: 8 },
      { header: "Points", key: "points", width: 8 },
      { header: "Shots", key: "shots", width: 8 },
      { header: "Saves", key: "saves", width: 8 },
      { header: "Season Avg", key: "avg", width: 12 },
      { header: "L5 Avg", key: "l5", width: 10 },
      { header: "L10 Avg", key: "l10", width: 10 },
      { header: "Hit Rate", key: "hitRate", width: 10 },
      { header: "TOI", key: "lastToi", width: 10 },
      { header: "Opponent", key: "lastOpp", width: 12 },
      { header: "Date", key: "lastDate", width: 12 },
    ];

    finalRows.forEach((r) => sheet.addRow(r));

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="nhl-${duration}-seasons.xlsx"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

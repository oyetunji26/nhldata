import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import ExcelJS from "exceljs";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchStats(type: string, season: string) {
  const sortParam = type === "goalie" ? "wins" : "skaterFullName";
  const url = `https://api.nhle.com/stats/rest/en/${type}/summary?isAggregate=false&isGame=false&sort=${sortParam}&start=0&limit=-1&cayenneExp=seasonId=${season}%20and%20gameTypeId=2`;
  const res = await axios.get(url);
  return res.data.data || [];
}

export async function GET(request: NextRequest) {
  try {
    // Get duration from query params, default to 7
    const { searchParams } = new URL(request.url);
    const duration = parseInt(searchParams.get("duration") || "7", 10);

    const playerMap = new Map();
    const currentYear = new Date().getFullYear();

    // Generate seasons based on user duration
    const seasons = Array.from({ length: duration }, (_, i) => {
      const start = currentYear - i;
      return `${start}${start + 1}`;
    });

    for (const season of seasons) {
      const [skaters, goalies] = await Promise.all([
        fetchStats("skater", season),
        fetchStats("goalie", season),
      ]);

      skaters.forEach((p: any) => {
        const id = p.playerId;
        if (!playerMap.has(id)) {
          playerMap.set(id, {
            name: p.skaterFullName,
            type: "Skater",
            goals: 0,
            points: 0,
            shots: 0,
            saves: 0,
          });
        }
        const entry = playerMap.get(id);
        entry.goals += p.goals || 0;
        entry.points += p.points || 0;
        entry.shots += p.shots || 0;
      });

      goalies.forEach((g: any) => {
        const id = g.playerId;
        if (!playerMap.has(id)) {
          playerMap.set(id, {
            name: g.goalieFullName,
            type: "Goalie",
            goals: 0,
            points: 0,
            shots: 0,
            saves: 0,
          });
        }
        playerMap.get(id).saves += g.saves || 0;
      });

      await sleep(150);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${duration}-Season NHL Stats`);
    sheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Type", key: "type", width: 10 },
      { header: "Goals", key: "goals", width: 10 },
      { header: "Points", key: "points", width: 10 },
      { header: "Shots", key: "shots", width: 10 },
      { header: "Saves", key: "saves", width: 10 },
    ];

    playerMap.forEach((data) => sheet.addRow(data));
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="nhl-${duration}-seasons.xlsx"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

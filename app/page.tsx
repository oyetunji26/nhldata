"use client"
import Image from "next/image";
import { useEffect, useState } from "react";


export default function Home() {
  const [duration, setDuration] = useState<number>(7);
  const [allTime, setAllTime] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);



  const currentYear = new Date()?.getFullYear()

  console.log(currentYear - 1917)



  useEffect(() => {
    if (allTime) {
      const durationSince1917 = currentYear - 1916;
      setDuration(durationSince1917);
    } else {
      setDuration(7)
    }
  }, [allTime, currentYear]);


  const handleClick = async () => {
    try {
      setIsDownloading(true);

      // 1. Fetch the data
      const response = await fetch(`/api/export?duration=${duration}`);

      if (!response.ok) throw new Error('Download failed');

      // 2. Convert response to a Blob (binary data)
      const blob = await response.blob();

      // 3. Create a temporary local URL for that blob
      const url = window.URL.createObjectURL(blob);

      // 4. Create a hidden <a> tag to trigger the download
      const link = document.createElement('a');
      link.href = url;

      // Set the filename (this should match your server-side header)
      link.download = `nhl-stats-${duration}-seasons.xlsx`;

      // 5. Append, click, and cleanup
      document.body.appendChild(link);
      link.click();

      // Remove the link and revoke the URL to save memory
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Export Error:", error);
      alert("There was an error generating your file.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-[#131314] font-sans ">
      <main className="flex flex-col items-center justify-between py-32 px-10  sm:items-start">
        <Image
          className="mx-auto"
          src="/nhl_logo.svg"
          alt="NHL logo"
          width={130}
          height={20}

          priority
        />

        <>
          <div className="mt-10 p-8  text-center">
            <h1 className="text-2xl font-bold mb-4 text-gray-100">Excel Data Exporter</h1>

            <div className="mb-6 flex flex-col gap-7">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Number of Seasons to Fetch:
                </label>
                <input
                  type="number"
                  min="1"
                  max={currentYear - 1917}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                  className="min-w-40 p-2 border text-white text-xl border-gray-600 bg-[#1E1F20] rounded-xl text-center focus:ring-2 focus:ring-blue-500 outline-none overflow-hidden"
                />
              </div>
              <div className="mt-2">
                <input type="checkbox" name="" id="" checked={allTime} onChange={(e) => setAllTime(!allTime)} /> &nbsp; <span>All seasons</span>
              </div>
            </div>


            <button
              onClick={handleClick}
              disabled={isDownloading}
              className="px-4 py-2 bg-lime-700 text-white rounded hover:bg-lime-950 disabled:bg-lime-950 flex items-center gap-3 mx-auto cursor-pointer"
            >

              {
                isDownloading ? <span className="loader" /> : (
                  <Image
                    className="mx-auto"
                    src="/downloadIcon.svg"
                    alt="NHL logo"
                    width={20}
                    height={20}

                    priority
                  />
                )
              }
              <span>{isDownloading ? 'Generating File...' : 'Download Stats'}</span>
            </button>

            <p className="mt-4 text-xs text-gray-500">
              *fetching data from 2025 back to {2025 - duration + 1}
            </p>
          </div>
        </>

      </main>

      <footer className="w-full pb-2">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">

            <p>© {currentYear} NHL Data Center. All rights reserved.</p>

            <div className="flex items-center space-x-2 group">
              <span className="text-gray-400">Developed with</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 fill-current animate-pulse" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span>by</span>
              <a href="https://yourportfolio.com"
                className="font-semibold text-gray-700 hover:text-blue-600 transition-colors duration-200 border-b border-transparent hover:border-blue-600">
                Oyetunji Olagoke
              </a>
            </div>

          </div>
        </div>
      </footer>
    </div>
  );
}

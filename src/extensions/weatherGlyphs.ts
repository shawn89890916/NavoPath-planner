const cloud = "M5 16a4 4 0 1 1 1-7.9A6 6 0 0 1 18 9a3.5 3.5 0 0 1 0 7";
export const weatherGlyphs = {
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5",
  cloud: `${cloud}H5`, fog: `${cloud}M4 19h16M7 22h10`, rain: `${cloud}M8 18l-1 3m6-3-1 3m6-3-1 3`, snow: `${cloud}M12 17v6m-2.6-4.5 5.2 3m-5.2 0 5.2-3`, storm: `${cloud}M13 15l-3 5h4l-2 3`, unknown: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01",
};

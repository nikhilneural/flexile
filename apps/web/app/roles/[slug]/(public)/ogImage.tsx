import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";

type Company = {
  name: string | null;
  brandColor: string | null;
};

// Note: Currently, using a fragment as `children` will create a `flex` div instead
export default async function ogImage(company: Company, children: React.ReactNode) {
  let color;
  if (company.brandColor) {
    const colorValue = parseInt(company.brandColor.slice(1), 16);
    // Simple lightness calculation to determine a contrast colour
    color = (colorValue & 0xff) + ((colorValue >> 8) & 0xff) + ((colorValue >> 16) & 0xff) > 384 ? "black" : "white";
  }
  const weights = { Regular: 400, Medium: 500, Bold: 700 } as const;
  const fonts = await Promise.all(
    Object.entries(weights).map(async ([name, weight]) => ({
      name: "ABC Whyte",
      data: await readFile(path.join(process.cwd(), `app/ABCWhyte-${name}.woff`)),
      weight,
    })),
  );

  return new ImageResponse(
    (
      <div
        tw="bg-blue-500 flex h-screen flex-col items-center justify-center p-16 text-center text-white w-full"
        style={{
          display: "flex",
          ...(company.brandColor ? { backgroundColor: company.brandColor, color } : {}),
        }}
      >
        <div tw="text-5xl mb-6">NOW HIRING</div>
        {children}
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}

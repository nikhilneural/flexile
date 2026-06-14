import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default function Image({ params }: { params: { slug: string; id: string } }) {
  const roleName = params.id.split("-").slice(0, -1).join(" ");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "white",
          padding: "60px",
        }}
      >
        <div style={{ fontSize: "72px", fontWeight: "bold", marginBottom: "24px" }}>
          {roleName || "Role"}
        </div>
        <div
          style={{
            display: "flex",
            backgroundColor: "black",
            color: "white",
            padding: "24px",
            borderRadius: "9999px",
            fontSize: "24px",
          }}
        >
          Apply now
        </div>
      </div>
    ),
    { ...size },
  );
}

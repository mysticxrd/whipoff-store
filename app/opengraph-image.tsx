import { ImageResponse } from "next/og";

export const alt = "Whipoff — Car Care";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#071410",
          color: "#f0ead9",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: "0.02em",
          }}
        >
          WHIPOFF
          <span style={{ color: "#c2a469" }}>.</span>
        </div>
        <div
          style={{
            marginTop: 24,
            display: "flex",
            color: "#c2a469",
            fontSize: 28,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Car Care
        </div>
      </div>
    ),
    { ...size },
  );
}

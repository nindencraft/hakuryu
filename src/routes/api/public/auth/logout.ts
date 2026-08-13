import { createFileRoute } from "@tanstack/react-router";

import { clearSessionCookie } from "@/lib/session.server";

export const Route = createFileRoute("/api/public/auth/logout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/auth",
            "Set-Cookie": clearSessionCookie(url.protocol === "https:"),
          },
        });
      },
    },
  },
});

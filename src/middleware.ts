import { auth } from "@/auth";

export default auth(() => {
  // Auth gates disabled until real Google OAuth credentials are configured.
  // To enable: check req.auth and redirect unauthenticated users.
});

export const config = {
  matcher: ["/curator/:path*", "/api/curator/:path*"],
};

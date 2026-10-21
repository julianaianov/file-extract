import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
 const response = NextResponse.next();
 if (!request.cookies.get("fe_guest")?.value) response.cookies.set("fe_guest", crypto.randomUUID(), { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 31536000 });
 return response;
}
export const config = { matcher: ["/"] };

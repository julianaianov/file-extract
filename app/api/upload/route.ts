import { processUpload } from "@/lib/process-upload";
import { withWorkspace } from "@/lib/workspace";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = withWorkspace(processUpload);

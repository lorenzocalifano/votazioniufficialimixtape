import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isMaster } from "@/lib/auth-helpers";

/**
 * Autorizza gli upload diretti dal browser a Vercel Blob: il file non passa
 * mai da questa funzione (che riceve solo la richiesta di token), quindi non
 * è soggetto al limite di ~4.5MB per richiesta delle funzioni serverless.
 * Protetto da sessione Master: solo il pannello organizzatore può caricare.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await isMaster())) {
          throw new Error("Non autorizzato.");
        }
        return {
          allowedContentTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"],
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: 300 * 1024 * 1024,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

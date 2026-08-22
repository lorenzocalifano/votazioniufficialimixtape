import TrackEditorClient from "./TrackEditorClient";

export default async function TrackEditorPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  return <TrackEditorClient trackId={trackId} />;
}

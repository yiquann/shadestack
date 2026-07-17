import { ModeSourcePicker } from "@/components/tryon/ModeSourcePicker";
import { FaceMeshTracker } from "@/components/tryon/FaceMeshTracker";

export default function TryOnPage() {
  return (
    <main className="px-5 pb-6 pt-6">
      <h1 className="font-display text-2xl text-ink">Try On</h1>
      <div className="mt-4">
        <ModeSourcePicker active="model" />
      </div>
      <div className="mt-4">
        <FaceMeshTracker />
      </div>
    </main>
  );
}

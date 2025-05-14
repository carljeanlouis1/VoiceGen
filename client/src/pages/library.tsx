import { LibraryGrid } from "@/components/library-grid";
import { AppLayout } from "@/components/ui-system/AppLayout";
import { COLORS } from "@/components/ui-system/design-tokens";

export default function Library() {
  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-[#0A84FF] to-[#30D158] bg-clip-text text-transparent">
            Your Library
          </h1>
          <p className="text-zinc-300 max-w-2xl">
            Access all your generated audio files. Listen, download, or delete your content.
          </p>
        </header>
        
        <LibraryGrid />
      </div>
    </AppLayout>
  );
}
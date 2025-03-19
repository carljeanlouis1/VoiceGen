import { LibraryGrid } from "@/components/library-grid";

export default function Library() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
        Your Library
      </h1>
      <LibraryGrid />
    </div>
  );
}
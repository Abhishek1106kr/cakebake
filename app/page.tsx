import { SceneCraft, SceneDiscovery, SceneFinale, SceneGlaze, SceneOpening, SceneSignatures, SceneStory, SceneVisit } from '@/components/home-scenes';

// The homepage is a film in scenes (see MOTION.md). Scene 09 is the existing footer.
export default function HomePage() {
  return (
    <main className="page home-film">
      <SceneOpening />
      <SceneCraft />
      <SceneSignatures />
      <SceneGlaze />
      <SceneDiscovery />
      <SceneStory />
      <SceneVisit />
      <SceneFinale />
    </main>
  );
}

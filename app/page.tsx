import { SceneCraft, SceneDiscovery, SceneFinale, SceneGlaze, SceneOpening, SceneStory, SceneVisit } from '@/components/home-scenes';
import { SceneCakeCollection, SceneCakeReveal, SceneCut, SceneSignatureCake } from '@/components/cake-scenes';
import { CustomerLove } from '@/components/story/customer-love';

// The homepage is a film in scenes (see MOTION.md). Cakes lead: the signature
// cake is revealed, then the collection; pastry craft, the cut and the counter
// follow. Customer love closes the film just above the existing footer.
export default function HomePage() {
  return (
    <main className="page home-film">
      <SceneOpening />
      <SceneCakeReveal />
      <SceneSignatureCake />
      <SceneCakeCollection />
      <SceneCraft />
      <SceneCut />
      <SceneGlaze />
      <SceneDiscovery />
      <SceneStory />
      <SceneVisit />
      <SceneFinale />
      <CustomerLove variant="compact" />
    </main>
  );
}

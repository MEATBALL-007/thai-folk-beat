import type { SceneManager } from '../core/SceneManager';
import type { SongDef } from '../audio/types';
import type { GameResult } from '../game/ScoreSystem';
import { settings } from '../core/Settings';

import { TitleScene } from './Title';
import { SettingsScene } from './Settings';
import { RegionSelectScene } from './RegionSelect';
import { SongSelectScene } from './SongSelect';
import { ComicScene } from './Comic';
import { LoadingScene } from './Loading';
import { GameplayScene } from './Gameplay';
import { ResultScene } from './Result';
import { audio } from '../audio/engine';
import { MOLAM } from '../audio/songs/molam';
import { SOENG } from '../audio/songs/soeng';

/**
 * The screen flow from spec §5, in one place.
 *
 * Scenes import this module rather than each other. The import cycle
 * (scene -> nav -> scene) is safe because every reference happens inside a
 * function body at runtime, never during module evaluation.
 */

export function goTitle(scenes: SceneManager): void {
  void scenes.replace(new TitleScene());
}

export function goSettings(scenes: SceneManager): void {
  void scenes.replace(new SettingsScene());
}

export function goRegionSelect(scenes: SceneManager): void {
  void scenes.replace(new RegionSelectScene());
}

export function goSongSelect(scenes: SceneManager): void {
  void scenes.replace(new SongSelectScene());
}

export function goComic(scenes: SceneManager, song: SongDef): void {
  void scenes.replace(new ComicScene(song));
}

/**
 * Spec §5.6. The song is loaded here rather than inside Gameplay, so the
 * progress bar reflects real work and gameplay starts with everything ready.
 */
export function goLoading(scenes: SceneManager, song: SongDef): void {
  void scenes.replace(
    new LoadingScene({
      detail: song.titleTh,
      // Real progress: the recording is a couple of megabytes, so the bar now
      // tracks an actual download and decode rather than two guessed steps.
      task: async (report) => {
        await audio.load(song, settings.difficulty, report);
      },
      onDone: () => goGameplay(scenes, song),
    }),
  );
}

export function goGameplay(scenes: SceneManager, song: SongDef): void {
  void scenes.replace(
    new GameplayScene(song, (result) => goResult(scenes, song, result)),
  );
}

export function goResult(scenes: SceneManager, song: SongDef, result: GameResult): void {
  if (import.meta.env.DEV) {
    (window as unknown as { __tfbResult?: GameResult }).__tfbResult = result;
  }

  void scenes.replace(
    new ResultScene(
      result,
      () => goLoading(scenes, song),
      () => goTitle(scenes),
    ),
  );
}

/**
 * DEV-only deep link: `?scene=settings` jumps straight to a screen instead of
 * clicking through the whole chain. Stripped from production by import.meta.env.
 */
export function goDevScene(scenes: SceneManager, name: string): boolean {
  if (!import.meta.env.DEV) return false;

  const song = name.endsWith('soeng') ? SOENG : MOLAM;

  switch (name.replace(/:.*$/, '')) {
    case 'title':
      goTitle(scenes);
      return true;
    case 'settings':
      goSettings(scenes);
      return true;
    case 'region':
      goRegionSelect(scenes);
      return true;
    case 'song':
      goSongSelect(scenes);
      return true;
    case 'comic':
      goComic(scenes, song);
      return true;
    case 'loading': {
      // DEV inspection only: the real loader finishes in milliseconds, so this
      // variant reports progress slowly enough to actually look at.
      void scenes.replace(
        new LoadingScene({
          detail: song.titleTh,
          task: async (report) => {
            const steps = 24;
            for (let i = 1; i <= steps; i++) {
              await new Promise((r) => setTimeout(r, 500));
              report(i / steps);
            }
          },
          onDone: () => goTitle(scenes),
        }),
      );
      return true;
    }
    case 'game':
      goGameplay(scenes, song);
      return true;
    case 'result':
      goResult(scenes, song, {
        songId: song.id,
        state: 'CLEARED',
        score: 48250,
        maxCombo: 96,
        perfect: 118,
        good: 24,
        miss: 8,
        accuracy: 0.87,
      });
      return true;
    default:
      return false;
  }
}

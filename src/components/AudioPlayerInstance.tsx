import { useEffect, useRef } from 'react';
import type { AudioTrack, PlayerSettings, Presentation } from '../core/model';
import { useAudio } from '../core/useAudio';
import { FloatingPlayer } from './FloatingPlayer';

export interface OpenAudioPlayer {
  owner: Presentation;
  track: AudioTrack;
  sourceSlideId: string;
  scopeSlideId: string;
  sourcePage: number;
  position: PlayerSettings;
  pinned: boolean;
  activations: number;
  order: number;
}
interface Props {
  player: OpenAudioPlayer;
  tracks: AudioTrack[];
  endBehavior: 'hold' | 'restart';
  opacity: number;
  onOpen: (id: string) => void;
  onPosition: (position: PlayerSettings, persist?: boolean) => void;
  onPin: () => void;
  onActivate: () => void;
  onClose: () => void;
}
export function AudioPlayerInstance({ player, tracks, endBehavior, opacity, ...events }: Props) {
  const audio = useAudio(player.track, endBehavior);
  const processed = useRef(0);
  useEffect(() => {
    if (audio.state.loading || !audio.state.duration || audio.state.error) return;
    const toggles = player.activations - processed.current;
    processed.current = player.activations;
    if (toggles % 2) audio.toggle();
  }, [
    player.activations,
    audio.state.loading,
    audio.state.duration,
    audio.state.error,
    audio.toggle,
  ]);
  return (
    <FloatingPlayer
      tracks={tracks}
      selected={player.track.id}
      select={events.onOpen}
      audio={audio}
      position={{ ...player.position, opacity }}
      onPosition={events.onPosition}
      pinned={player.pinned}
      onPin={events.onPin}
      onActivate={events.onActivate}
      order={player.order}
      sourcePage={player.sourcePage}
      onClose={events.onClose}
    />
  );
}

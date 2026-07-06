'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminInboxPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeClip, setActiveClip] = useState<any | null>(null);
  
  // YouTube Player Ref
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchInbox();
  }, []);
  
  const fetchInbox = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/inbox');
    const data = await res.json();
    if (data.items) {
      setItems(data.items);
    }
    setLoading(false);
  };
  
  // Player Setup
  useEffect(() => {
    if (!activeClip || !containerRef.current) return;
    
    // Cleanup old player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    
    const ytWin = window as any;
    if (!ytWin.YT || !ytWin.YT.Player) return;
    
    playerRef.current = new ytWin.YT.Player(containerRef.current, {
      videoId: activeClip.video_id,
      playerVars: {
        autoplay: 1,
        start: Math.floor(activeClip.start_sec),
        end: Math.ceil(activeClip.end_sec),
        controls: 1,
        rel: 0,
      },
      events: {
        onStateChange: (event: any) => {
          if (event.data === ytWin.YT.PlayerState.ENDED) {
            // Replay logic can go here if needed
          }
        }
      }
    });
    
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [activeClip]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleApproveBatch = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Approve ${selectedIds.size} clips?`)) return;
    
    const res = await fetch('/api/admin/inbox/approve', {
      method: 'POST',
      body: JSON.stringify({ clip_ids: Array.from(selectedIds) })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Approved ${selectedIds.size} clips!`);
      setSelectedIds(new Set());
      fetchInbox();
      setActiveClip(null);
    }
  };
  
  const handleDelete = async (clip_id: string) => {
    if (!confirm('Delete this clip?')) return;
    await fetch('/api/admin/inbox', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', clip_id })
    });
    fetchInbox();
    if (activeClip?.clip_id === clip_id) setActiveClip(null);
  };

  if (loading) return <div className="p-8">Loading Inbox...</div>;

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Content Inbox (Pending: {items.length})</h1>
        <button 
          onClick={handleApproveBatch}
          disabled={selectedIds.size === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Approve Selected ({selectedIds.size})
        </button>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left: List */}
        <div className="w-1/2 overflow-y-auto border rounded bg-white">
          {items.map(item => (
            <div 
              key={item.clip_id} 
              className={`p-4 border-b flex gap-4 cursor-pointer hover:bg-gray-50 ${activeClip?.clip_id === item.clip_id ? 'bg-blue-50' : ''}`}
              onClick={() => setActiveClip(item)}
            >
              <div className="pt-1">
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(item.clip_id)}
                  onChange={() => toggleSelect(item.clip_id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <img
                src={`https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg`}
                alt="thumb"
                className="w-32 h-20 object-cover rounded"
              />
              <div className="flex-1">
                <div className="font-semibold text-sm">{item.target_phrase}</div>
                <div className="text-sm text-gray-600 mt-1">{item.translation}</div>
                <div className="text-xs text-gray-400 mt-2">
                  {item.player_name} • {item.start_sec}s - {item.end_sec}s
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Preview & Edit */}
        <div className="w-1/2 bg-white border rounded p-4 flex flex-col">
          {!activeClip ? (
            <div className="text-gray-400 text-center mt-20">Select a clip to preview</div>
          ) : (
            <>
              <div className="aspect-video bg-black mb-4">
                <div ref={containerRef} className="w-full h-full" />
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1">Target Phrase</label>
                  <input type="text" className="w-full border p-2 rounded" defaultValue={activeClip.target_phrase} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Translation</label>
                  <input type="text" className="w-full border p-2 rounded" defaultValue={activeClip.translation} />
                </div>
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-xs font-bold mb-1">Pause At (sec)</label>
                    <input type="number" step="0.1" className="w-full border p-2 rounded" defaultValue={activeClip.pause_at} />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-xs font-bold mb-1">Difficulty</label>
                    <select className="w-full border p-2 rounded" defaultValue={activeClip.difficulty}>
                      <option value="A">A (Hard/Useful)</option>
                      <option value="B">B (Medium)</option>
                      <option value="C">C (Easy)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex justify-between">
                <button 
                  onClick={() => handleDelete(activeClip.clip_id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded"
                >
                  Delete Clip
                </button>
                <button 
                  className="px-4 py-2 bg-gray-800 text-white rounded"
                  onClick={() => alert('Inline save logic not fully wired in UI yet (API exists).')}
                >
                  Save Edits
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { Moon, Heart, Cloud, Footprints } from 'lucide-react'

// Matches the floating-badge style of SaltamontesBackground/FloatingIconsBackground
// (Hormiguitas/Exploradores already had one each — Corderitos didn't).
type El = { kind: 'icon'; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; bg: string; color: string }
         | { kind: 'emoji'; char: string; bg: string }

const ELS: El[] = [
  { kind:'emoji', char:'🍼', bg:'#fce7f3' },
  { kind:'icon',  Icon:Moon,       bg:'#ede9fe', color:'#7c3aed' },
  { kind:'emoji', char:'🧸', bg:'#fef3c7' },
  { kind:'icon',  Icon:Heart,      bg:'#ffe4e6', color:'#e11d48' },
  { kind:'emoji', char:'🎀', bg:'#fce7f3' },
  { kind:'icon',  Icon:Cloud,      bg:'#e0f2fe', color:'#0ea5e9' },
  { kind:'emoji', char:'⭐', bg:'#fef9c3' },
  { kind:'icon',  Icon:Footprints, bg:'#ffe4e6', color:'#fb7185' },
]

const POS = [
  {x:5,y:7},{x:80,y:5},{x:45,y:2},{x:90,y:32},
  {x:4,y:48},{x:20,y:65},{x:68,y:70},{x:55,y:18},
]

export function Corderitos02Background() {
  return (
    // top offset (not inset-0) keeps shapes below the sticky header — see BalloonBackground.tsx for why.
    <div
      className="fixed inset-x-0 bottom-0 overflow-hidden pointer-events-none z-0"
      style={{ top: 'calc(4.5rem + env(safe-area-inset-top))' }}
    >
      {ELS.map((el, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left:`${POS[i].x}%`, top:`${POS[i].y}%`,
            animation:`bg-appear .35s ease-out ${i*0.12}s both, float-${i%4} ${3.6+(i%4)*.4}s ease-in-out ${i*0.12}s infinite`,
          }}
        >
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{backgroundColor:el.bg}}>
            {el.kind==='emoji'
              ? <span className="text-xl leading-none select-none">{el.char}</span>
              : <el.Icon size={20} style={{color:el.color}} />}
          </div>
        </div>
      ))}
    </div>
  )
}

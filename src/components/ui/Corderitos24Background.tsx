import { Blocks, Puzzle, Palette, Star } from 'lucide-react'

// Same floating-badge style as Corderitos02Background, but toddler-leaning
// motifs (blocks/puzzle/crayons) instead of infant ones (bottle/pacifier).
type El = { kind: 'icon'; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; bg: string; color: string }
         | { kind: 'emoji'; char: string; bg: string }

const ELS: El[] = [
  { kind:'icon',  Icon:Blocks,  bg:'#fef3c7', color:'#d97706' },
  { kind:'emoji', char:'🦆', bg:'#fef9c3' },
  { kind:'icon',  Icon:Puzzle,  bg:'#d1fae5', color:'#059669' },
  { kind:'emoji', char:'🎨', bg:'#fce7f3' },
  { kind:'icon',  Icon:Palette, bg:'#fdf4ff', color:'#c026d3' },
  { kind:'emoji', char:'🧩', bg:'#ffe4e6' },
  { kind:'icon',  Icon:Star,    bg:'#ffe4e6', color:'#e11d48' },
  { kind:'emoji', char:'🚗', bg:'#e0f2fe' },
]

const POS = [
  {x:5,y:7},{x:80,y:5},{x:45,y:2},{x:90,y:32},
  {x:4,y:48},{x:20,y:65},{x:68,y:70},{x:55,y:18},
]

export function Corderitos24Background() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
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

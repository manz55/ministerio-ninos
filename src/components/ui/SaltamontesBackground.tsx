import { Zap, Sun, Leaf, Music } from 'lucide-react'

type El = { kind: 'icon'; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; bg: string; color: string }
         | { kind: 'emoji'; char: string; bg: string }

const ELS: El[] = [
  { kind:'emoji', char:'🦗', bg:'#fef3c7' },
  { kind:'icon',  Icon:Zap,  bg:'#fef9c3', color:'#d97706' },
  { kind:'emoji', char:'🌿', bg:'#d1fae5' },
  { kind:'icon',  Icon:Sun,  bg:'#fef9c3', color:'#ca8a04' },
  { kind:'emoji', char:'🌸', bg:'#fce7f3' },
  { kind:'icon',  Icon:Leaf, bg:'#d1fae5', color:'#16a34a' },
  { kind:'emoji', char:'⭐', bg:'#fef3c7' },
  { kind:'icon',  Icon:Music,bg:'#ede9fe', color:'#7c3aed' },
]

const POS = [
  {x:5,y:7},{x:80,y:5},{x:45,y:2},{x:90,y:32},
  {x:4,y:48},{x:20,y:65},{x:68,y:70},{x:55,y:18},
]

export function SaltamontesBackground() {
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

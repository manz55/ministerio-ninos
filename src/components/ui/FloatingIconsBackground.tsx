import { Compass, Map, Globe, BookOpen, Star, Flag, Sun, Award } from 'lucide-react'

const ICONS = [
  {Icon:Compass, bg:'#e0f2fe', color:'#0284c7'},
  {Icon:Map,     bg:'#ede9fe', color:'#7c3aed'},
  {Icon:Globe,   bg:'#d1fae5', color:'#059669'},
  {Icon:BookOpen,bg:'#fef3c7', color:'#d97706'},
  {Icon:Star,    bg:'#fce7f3', color:'#db2777'},
  {Icon:Flag,    bg:'#e0f2fe', color:'#0ea5e9'},
  {Icon:Sun,     bg:'#fef9c3', color:'#ca8a04'},
  {Icon:Award,   bg:'#fdf4ff', color:'#9333ea'},
]

const POS = [
  {x:4,y:8},{x:82,y:6},{x:44,y:3},{x:3,y:42},
  {x:88,y:40},{x:20,y:70},{x:70,y:72},{x:55,y:20},
]

export function FloatingIconsBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {ICONS.map(({Icon,bg,color},i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left:`${POS[i].x}%`, top:`${POS[i].y}%`,
            animation:`bg-appear .35s ease-out ${i*0.12}s both, float-${i%4} ${3.6+(i%4)*.4}s ease-in-out ${i*0.12}s infinite`,
          }}
        >
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{backgroundColor:bg}}>
            <Icon size={20} style={{color}} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Sistema de íconos de Banana Burn. Úsalo SIEMPRE desde aquí (nunca emojis, nunca lucide-react):
//   - Íconos de marca (bananas y monos) para todo lo que es identidad: racha, XP, niveles, logros, coach, estados vacíos.
//   - Phosphor para lo utilitario (navegación, acciones, formularios), con el mismo trazo.
// Convención de peso: controles pequeños (chevrons, cerrar, +/−) → weight="bold"; íconos de contenido → weight="duotone".
// Las exportaciones "ssr" de Phosphor funcionan en componentes de servidor y de cliente.
export * from "./brand";
export { BrandIcon, LevelIcon } from "./named";
export {
  ArrowLeft, ArrowRight, ArrowUp, ArrowsLeftRight, ArrowCounterClockwise, Barbell, Bell, BellSlash, BookOpen, BowlFood, Brain, Camera,
  CaretLeft, CaretRight, CaretDown, ChartLine, ChatCircle, Check, CheckCircle, Checks, CircleNotch, Clock, Copy, CreditCard, DownloadSimple, Drop,
  Egg, Envelope, Fish, Flag, Footprints, ForkKnife, Gear, Gift, GraduationCap, Handshake, Heart, Heartbeat, House, Info, Lightning, Lock, MagnifyingGlass,
  Megaphone, Minus, Moon, PaperPlaneTilt, Plus, PlusSquare, Receipt, Repeat, Ruler, Scales, Scroll, ShareNetwork, Shield, ShieldCheck,
  ShieldWarning, SignOut, Sparkle, SquaresFour, Target, Timer, Trash, TrendDown, TrendUp, User, UserGear, Users, Warning, WarningCircle,
  Watch, X, Sun, Moon as Night, Medal, Play, Pause, SkipForward, SpeakerHigh, SpeakerSlash, Calendar, CalendarCheck, PersonSimpleRun,
  Carrot, Cookie, Leaf, Coffee, Pill, Syringe, Smiley, SmileyMeh, SmileySad, Star, Eye, EyeSlash, PencilSimple, DotsThree, Link, Export,
  Bed, Books, Confetti, FlagCheckered, PersonArmsSpread, PersonSimpleWalk, PushPin, TreePalm,
} from "@phosphor-icons/react/dist/ssr";
export type { Icon as PhosphorIcon, IconWeight } from "@phosphor-icons/react";

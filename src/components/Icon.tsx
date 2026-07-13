import {
  Book,
  Wallet,
  CreditCard,
  DollarSign,
  PieChart,
  List,
  Calendar,
  ShoppingBag,
  ShoppingCart,
  Home,
  Car,
  Plane,
  GraduationCap,
  Heart,
  Star,
  Utensils,
  Gamepad2,
  BriefcaseMedical,
  BookOpen,
  Phone,
  PawPrint,
  MoreHorizontal,
  Banknote,
  Gift,
  TrendingUp,
  Briefcase,
  Mail,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  book: Book,
  wallet: Wallet,
  'credit-card': CreditCard,
  'dollar-sign': DollarSign,
  'pie-chart': PieChart,
  list: List,
  calendar: Calendar,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  home: Home,
  car: Car,
  plane: Plane,
  'graduation-cap': GraduationCap,
  heart: Heart,
  star: Star,
  utensils: Utensils,
  'gamepad-2': Gamepad2,
  'briefcase-medical': BriefcaseMedical,
  'book-open': BookOpen,
  phone: Phone,
  'paw-print': PawPrint,
  'more-horizontal': MoreHorizontal,
  banknote: Banknote,
  gift: Gift,
  'trending-up': TrendingUp,
  briefcase: Briefcase,
  mail: Mail,
  'plus-circle': PlusCircle,
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className = '' }: IconProps) {
  const IconComponent = iconMap[name] || MoreHorizontal;
  return <IconComponent size={size} className={className} />;
}

import { Link } from 'react-router';
import { ArrowRight, LucideIcon } from 'lucide-react';

interface ServiceCardProps {
  id: number;
  name: string;
  icon: LucideIcon;
  color: string;
}

export function ServiceCard({ id, name, icon: Icon, color }: ServiceCardProps) {
  return (
    <Link
      to={`/request/${id}`}
      className="group relative flex flex-col items-center gap-3 p-6 rounded-2xl border bg-white hover:shadow-lg hover:scale-105 transition-all duration-200"
    >
      <div className={`p-4 rounded-xl ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <span className="font-medium text-center">{name}</span>
      <ArrowRight className="absolute top-4 right-4 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

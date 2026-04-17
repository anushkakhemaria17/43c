import React from 'react';
import { motion } from 'framer-motion';

const FlowStepCard = ({ stepNumber, icon: Icon, title, description, isLast }) => {
  return (
    <div className="relative flex gap-6 pb-12 last:pb-0 group">
      {/* Connector Line */}
      {!isLast && (
        <div className="absolute left-6 top-14 bottom-0 w-[1px] bg-gradient-to-b from-accent/40 to-transparent group-hover:from-accent transition-colors" />
      )}

      {/* Step Circle */}
      <div className="relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-accent/40 group-hover:shadow-[0_0_20px_rgba(212,169,95,0.15)] transition-all duration-500">
           <div className="absolute -top-1 -left-1 w-5 h-5 rounded-lg bg-accent text-primary text-[10px] font-black flex items-center justify-center shadow-lg">
             {stepNumber}
           </div>
           {Icon && <Icon className="text-accent group-hover:scale-110 transition-transform duration-500" size={20} />}
        </div>
      </div>

      {/* Content */}
      <div className="pt-1">
        <h4 className="text-lg font-heading text-white mb-1.5 group-hover:text-accent transition-colors">
          {title}
        </h4>
        <p className="text-xs text-white/40 leading-relaxed font-light max-w-sm">
          {description}
        </p>
      </div>
    </div>
  );
};

export default FlowStepCard;


import React, { useState } from 'react';
import { Camera, Check, HelpCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface TutorialModalProps {
  onClose: () => void;
  studioName: string;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ onClose, studioName }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: `Welcome to ${studioName}!`,
      description: 'We are excited to share your beautiful photo session. This short guide will show you how to select your favorites for final touch-ups and delivery.',
      icon: Camera
    },
    {
      title: 'How to Select Photos',
      description: 'Browse the gallery grid and click anywhere on a photograph or its checkmark to select it. A selected photo will show a golden highlight and a checkmark.',
      icon: Check
    },
    {
      title: 'Live Photo Counter',
      description: 'At the top and bottom of your screen, a live counter tracks how many photos you have selected relative to your package allowance.',
      icon: HelpCircle
    },
    {
      title: 'Extra Photo Charges',
      description: 'If you exceed your package limit, the live counter will calculate your additional selection count and cost. You can select as many extras as you wish!',
      icon: HelpCircle
    },
    {
      title: 'Preview Your Selection',
      description: 'Click "Review Selection" at any time to open a preview. You can review large thumbnails of all your selections to make final comparisons.',
      icon: HelpCircle
    },
    {
      title: 'Confirm & Submit',
      description: 'Once you are satisfied, click "Confirm Selection". Note: After submitting, your gallery will lock and you will need to contact the studio to make changes.',
      icon: HelpCircle
    },
    {
      title: 'Ready to Begin?',
      description: 'Let\'s get started! Your favorites are just a click away.',
      icon: Camera
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const StepIcon = steps[currentStep].icon;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative animate-scale-up text-white p-6 md:p-8 space-y-6">
        
        {/* Step Indicator */}
        <div className="flex justify-between items-center text-xs font-semibold text-brand-gold uppercase tracking-widest">
          <span>Tutorial</span>
          <span>
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>

        {/* Big Step Icon */}
        <div className="flex justify-center py-4">
          <div className="bg-brand-blue/10 p-5 rounded-3xl border border-brand-gold/30 text-brand-gold animate-bounce-slow">
            <StepIcon className="w-12 h-12" />
          </div>
        </div>

        {/* Text Area */}
        <div className="text-center space-y-3">
          <h3 className="font-display font-extrabold text-xl tracking-wide text-white leading-tight">
            {steps[currentStep].title}
          </h3>
          <p className="text-sm text-slate-400 font-medium leading-relaxed min-h-[70px]">
            {steps[currentStep].description}
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep ? 'w-6 bg-brand-gold' : 'w-1.5 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Controls Layout */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-sm font-semibold">
          {currentStep < steps.length - 1 ? (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Skip
            </button>
          ) : (
            <div className="w-6" /> // Placeholder to keep spacing
          )}

          <div className="flex gap-2.5">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="bg-slate-850 hover:bg-slate-800 text-slate-350 border border-slate-800 hover:text-white py-2 px-4 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="bg-brand-blue hover:bg-brand-blue-dark text-white py-2 px-5 rounded-xl border border-brand-blue flex items-center gap-1.5 transition-all shadow-lg shadow-brand-blue/10"
            >
              <span>{currentStep === steps.length - 1 ? 'Finish' : 'Next'}</span>
              {currentStep < steps.length - 1 && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

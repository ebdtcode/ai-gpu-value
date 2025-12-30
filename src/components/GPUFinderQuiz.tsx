import { useState, useMemo } from 'react';
import type { GPUWithData } from '../types';

interface GPUFinderQuizProps {
  allGPUs: GPUWithData[];
}

interface QuizAnswers {
  budget: string;
  primaryUse: string;
  vramNeed: string;
  condition: string;
  powerConstraint: string;
}

type QuizStep = 'budget' | 'primaryUse' | 'vramNeed' | 'condition' | 'powerConstraint' | 'results';

const questions: Record<Exclude<QuizStep, 'results'>, {
  title: string;
  subtitle: string;
  options: { value: string; label: string; description: string }[];
}> = {
  budget: {
    title: "What's your budget?",
    subtitle: "Including the cost of a used card if you're open to that",
    options: [
      { value: 'under300', label: 'Under $300', description: 'Entry-level AI capabilities' },
      { value: '300to600', label: '$300 - $600', description: 'Good balance of price and performance' },
      { value: '600to1000', label: '$600 - $1,000', description: 'High-end capabilities' },
      { value: 'over1000', label: '$1,000+', description: 'Maximum performance' },
    ],
  },
  primaryUse: {
    title: 'What will you primarily use the GPU for?',
    subtitle: 'Choose your main AI workload',
    options: [
      { value: 'sd', label: 'Stable Diffusion / Image Gen', description: 'SDXL, Flux, ComfyUI, etc.' },
      { value: 'llm', label: 'LLM Inference', description: 'Running local chatbots, Ollama, llama.cpp' },
      { value: 'training', label: 'Model Training / Fine-tuning', description: 'LoRA training, model development' },
      { value: 'mixed', label: 'Mixed / All of the above', description: 'General AI experimentation' },
    ],
  },
  vramNeed: {
    title: 'What models do you want to run?',
    subtitle: 'This determines your VRAM requirements',
    options: [
      { value: 'small', label: 'SD 1.5 / 7B LLMs', description: '8GB VRAM is sufficient' },
      { value: 'medium', label: 'SDXL / 13B LLMs', description: '12GB VRAM recommended' },
      { value: 'large', label: 'Flux / 30B LLMs', description: '16-24GB VRAM needed' },
      { value: 'xlarge', label: '70B+ LLMs / Training', description: '24GB+ VRAM required' },
    ],
  },
  condition: {
    title: 'Are you open to used GPUs?',
    subtitle: 'Used cards offer significantly better value',
    options: [
      { value: 'new', label: 'New Only', description: "I want warranty and peace of mind" },
      { value: 'used', label: 'Used is Fine', description: "I'm okay with tested used cards" },
      { value: 'any', label: 'Best Value Either Way', description: 'Show me the best options regardless' },
    ],
  },
  powerConstraint: {
    title: 'Do you have power supply constraints?',
    subtitle: 'High-end GPUs can draw 300-600W',
    options: [
      { value: 'low', label: 'Yes, limited PSU (<600W)', description: 'Need efficient cards under 200W' },
      { value: 'medium', label: 'Moderate PSU (600-850W)', description: 'Can handle most cards up to 350W' },
      { value: 'high', label: 'No constraints (850W+)', description: 'Can run any GPU' },
    ],
  },
};

const stepOrder: QuizStep[] = ['budget', 'primaryUse', 'vramNeed', 'condition', 'powerConstraint', 'results'];

export default function GPUFinderQuiz({ allGPUs }: GPUFinderQuizProps) {
  const [currentStep, setCurrentStep] = useState<QuizStep>('budget');
  const [answers, setAnswers] = useState<QuizAnswers>({
    budget: '',
    primaryUse: '',
    vramNeed: '',
    condition: '',
    powerConstraint: '',
  });

  const handleAnswer = (step: Exclude<QuizStep, 'results'>, value: string) => {
    setAnswers((prev) => ({ ...prev, [step]: value }));
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const restart = () => {
    setCurrentStep('budget');
    setAnswers({
      budget: '',
      primaryUse: '',
      vramNeed: '',
      condition: '',
      powerConstraint: '',
    });
  };

  const recommendations = useMemo(() => {
    if (currentStep !== 'results') return [];

    // Filter GPUs based on answers
    let filtered = [...allGPUs];

    // Budget filter
    const budgetRanges: Record<string, { min: number; max: number }> = {
      under300: { min: 0, max: 300 },
      '300to600': { min: 300, max: 600 },
      '600to1000': { min: 600, max: 1000 },
      over1000: { min: 1000, max: Infinity },
    };
    const budget = budgetRanges[answers.budget];
    if (budget) {
      filtered = filtered.filter((gpu) => {
        const price = answers.condition === 'new'
          ? gpu.lowestNewPrice
          : (gpu.lowestUsedPrice || gpu.lowestNewPrice);
        return price && price >= budget.min && price <= budget.max;
      });
    }

    // VRAM filter based on model needs
    const vramRequirements: Record<string, number> = {
      small: 8,
      medium: 12,
      large: 16,
      xlarge: 24,
    };
    const minVram = vramRequirements[answers.vramNeed] || 8;
    filtered = filtered.filter((gpu) => gpu.vramGb >= minVram);

    // Condition filter
    if (answers.condition === 'new') {
      filtered = filtered.filter((gpu) => gpu.lowestNewPrice != null);
    }

    // Power constraint filter
    const powerLimits: Record<string, number> = {
      low: 200,
      medium: 350,
      high: Infinity,
    };
    const maxPower = powerLimits[answers.powerConstraint] || Infinity;
    filtered = filtered.filter((gpu) => gpu.tdpWatts <= maxPower);

    // Sort by value score (descending), then by relevant benchmark
    filtered.sort((a, b) => {
      // Prioritize value score
      const valueA = a.valueScore || 0;
      const valueB = b.valueScore || 0;
      if (valueB !== valueA) return valueB - valueA;

      // Then by relevant benchmark based on use case
      if (answers.primaryUse === 'sd') {
        return (b.benchmarks?.sdxlImgsPerMin || 0) - (a.benchmarks?.sdxlImgsPerMin || 0);
      }
      if (answers.primaryUse === 'llm') {
        return (b.benchmarks?.llm7bTokensPerSec || 0) - (a.benchmarks?.llm7bTokensPerSec || 0);
      }
      return 0;
    });

    return filtered.slice(0, 5);
  }, [allGPUs, answers, currentStep]);

  const currentIndex = stepOrder.indexOf(currentStep);
  const progress = currentStep === 'results' ? 100 : (currentIndex / (stepOrder.length - 1)) * 100;

  if (currentStep === 'results') {
    return (
      <div className="quiz-container">
        <div className="quiz-progress">
          <div className="quiz-progress__bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="quiz-results">
          <h2 className="quiz-results__title">Your GPU Recommendations</h2>
          <p className="quiz-results__subtitle">
            Based on your answers, here are the best GPUs for you:
          </p>

          {recommendations.length === 0 ? (
            <div className="quiz-no-results">
              <p>No GPUs match your exact criteria. Try adjusting your budget or requirements.</p>
              <button onClick={restart} className="quiz-btn quiz-btn--primary">
                Start Over
              </button>
            </div>
          ) : (
            <>
              <div className="quiz-recommendations">
                {recommendations.map((gpu, index) => {
                  const price = answers.condition === 'new'
                    ? gpu.lowestNewPrice
                    : (gpu.lowestUsedPrice || gpu.lowestNewPrice);
                  const condition = answers.condition === 'new' ? 'New' : (gpu.lowestUsedPrice ? 'Used' : 'New');

                  return (
                    <a
                      key={gpu.id}
                      href={`/gpus/${gpu.slug}`}
                      className={`quiz-recommendation ${index === 0 ? 'quiz-recommendation--top' : ''}`}
                    >
                      {index === 0 && <span className="quiz-recommendation__badge">Best Match</span>}
                      <div className="quiz-recommendation__rank">#{index + 1}</div>
                      <div className="quiz-recommendation__content">
                        <h3 className="quiz-recommendation__name">{gpu.name}</h3>
                        <div className="quiz-recommendation__specs">
                          <span>{gpu.vramGb}GB VRAM</span>
                          <span>{gpu.tdpWatts}W TDP</span>
                          <span>Value: {gpu.valueScore}/100</span>
                        </div>
                        {gpu.benchmarks && (
                          <div className="quiz-recommendation__benchmarks">
                            {answers.primaryUse === 'sd' || answers.primaryUse === 'mixed' ? (
                              <span>SDXL: {gpu.benchmarks.sdxlImgsPerMin} img/min</span>
                            ) : null}
                            {answers.primaryUse === 'llm' || answers.primaryUse === 'mixed' ? (
                              <span>LLM 7B: {gpu.benchmarks.llm7bTokensPerSec} tok/s</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="quiz-recommendation__price">
                        <span className="quiz-recommendation__price-value">
                          ${price?.toLocaleString() || 'N/A'}
                        </span>
                        <span className="quiz-recommendation__price-condition">{condition}</span>
                      </div>
                    </a>
                  );
                })}
              </div>

              <div className="quiz-actions">
                <button onClick={restart} className="quiz-btn quiz-btn--secondary">
                  Start Over
                </button>
                <a href="/compare" className="quiz-btn quiz-btn--primary">
                  Compare These GPUs
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const question = questions[currentStep as Exclude<QuizStep, 'results'>];

  return (
    <div className="quiz-container">
      <div className="quiz-progress">
        <div className="quiz-progress__bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="quiz-step">
        <div className="quiz-step__header">
          <span className="quiz-step__number">
            Question {currentIndex + 1} of {stepOrder.length - 1}
          </span>
          <h2 className="quiz-step__title">{question.title}</h2>
          <p className="quiz-step__subtitle">{question.subtitle}</p>
        </div>

        <div className="quiz-options">
          {question.options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleAnswer(currentStep as Exclude<QuizStep, 'results'>, option.value)}
              className={`quiz-option ${answers[currentStep as keyof QuizAnswers] === option.value ? 'quiz-option--selected' : ''}`}
            >
              <span className="quiz-option__label">{option.label}</span>
              <span className="quiz-option__description">{option.description}</span>
            </button>
          ))}
        </div>

        {currentIndex > 0 && (
          <button onClick={goBack} className="quiz-btn quiz-btn--back">
            &larr; Back
          </button>
        )}
      </div>
    </div>
  );
}

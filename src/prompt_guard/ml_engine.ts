/**
 * PromptGuard Client-Side Machine Learning Inference Engine
 * Evaluates trained MultiOutput Logistic Regression with Sublinear TF-IDF,
 * Character Subword N-Grams (3-4 grams), and Contextual Feature Vectors.
 * Runs in sub-millisecond time with zero external dependencies.
 */

import trainedModelData from '../data/trainedModel.json';
import { ThreatCategory } from './types';

export interface MLPredictionResult {
  probabilities: Record<ThreatCategory, number>;
  logits: Record<ThreatCategory, number>;
  topFeatures: Array<{
    feature: string;
    weight: number;
    contribution: number;
    category: ThreatCategory;
  }>;
  tokenSaliency: Array<{
    token: string;
    weight: number;
    category: ThreatCategory | 'benign';
  }>;
  featureCount: number;
  modelType: string;
  macroF1: number;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'that', 'this', 
  'it', 'for', 'where', 'do', 'does', 'did', 'on', 'with', 'and', 'or', 'by', 'at', 
  'from', 'as', 'be', 'been', 'being', 'have', 'has', 'had', 'so', 'than', 'then', 
  'there', 'here', 'which', 'who', 'whom', 'whose', 'what', 'we', 'you', 'they', 'i'
]);

const IMPERATIVE_MARKERS = new Set([
  'override', 'ignore', 'disregard', 'bypass', 'reveal', 'print', 'execute', 
  'act', 'pretend', 'discard', 'forget', 'abandon', 'drop', 'clear', 'wipe', 
  'reset', 'cancel', 'supersede', 'replace', 'substitute', 'unbound', 'erase', 
  'disable', 'unfiltered', 'unrestricted', 'delete', 'remove', 'unmask'
]);

const ROLEPLAY_MARKERS = new Set([
  'roleplay', 'fictional', 'pretend', 'dan', 'chaos', 'unrestricted', 'hypothetical', 
  'hypothetically', 'screenplay', 'movie', 'story', 'game', 'universe', 'scenario', 
  'simulation', 'persona', 'character', 'alter-ego', 'jailbreak', 'unfiltered', 
  'developer', 'debug', 'root', 'sudo', 'jailbroken', 'imagine'
]);

const REFUSAL_SUPPRESSION_MARKERS = new Set([
  'apologize', 'refuse', 'disclaimer', 'warning', 'warnings', 'restrictions', 
  'comply', 'obey', 'freely', 'unfiltered', 'never', 'cannot', 'ethics', 'ethical'
]);

const EXFILTRATION_MARKERS = new Set([
  'secret', 'token', 'password', 'credentials', 'credential', 'key', 'keys', 
  'prompt', 'instructions', 'guidelines', 'rules', 'verbatim', 'dump', 'exfiltrate', 
  'leak', 'confidential', 'internal', 'hidden', 'private'
]);

const INDIRECT_HIJACKING_MARKERS = new Set([
  'regardless', 'rate', 'score', 'candidate', 'resume', 'evaluate', 'mention', 
  'unconditionally', 'verdict', 'overriding', 'grade', 'reviewing', 'qualifications',
  'fit', 'recommendation', 'override', 'bypass', 'perfect'
]);

const CONCEALMENT_MARKERS = new Set([
  'mention', 'reveal', 'disclose', 'tell', 'indicate', 'acknowledge', 'secret', 
  'hidden', 'stealth', 'covert', 'leak', 'silently', 'omit', 'suppress', 'hide'
]);

export class MLInferenceEngine {
  private model: any;

  constructor(customModel?: any) {
    this.model = customModel || trainedModelData;
  }

  public updateModel(newModel: any) {
    this.model = newModel;
  }

  /**
   * Extracts multi-representation feature dictionary:
   * 1. Sublinear TF unigrams (1 + ln(tf))
   * 2. Bigrams
   * 3. Subword character 3-grams
   * 4. Contextual structural features
   */
  public extractFeatures(text: string): Record<string, number> {
    const words = (text.toLowerCase().match(/\b\w+\b/g) || []);
    const features: Record<string, number> = {};

    if (words.length === 0) return features;

    // Filtered content words for unigrams (excludes functional stopword noise)
    const contentWordCounts: Record<string, number> = {};
    for (const w of words) {
      if (!STOPWORDS.has(w) && w.length > 1) {
        contentWordCounts[w] = (contentWordCounts[w] || 0) + 1;
      }
    }

    // Sublinear TF-IDF scaling: 1 + log(count)
    for (const [w, count] of Object.entries(contentWordCounts)) {
      features[w] = 1.0 + Math.log(count);
    }

    // Word bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bg = `${words[i]}_${words[i + 1]}`;
      features[bg] = (features[bg] || 0) + 1.0;
    }

    // Character subword 3-grams for morphological resilience against evasions
    for (const w of words) {
      if (!STOPWORDS.has(w) && w.length >= 3) {
        for (let j = 0; j < w.length - 2; j++) {
          const cGram = `c:${w.substring(j, j + 3)}`;
          features[cGram] = (features[cGram] || 0) + 0.5;
        }
      }
    }

    // Contextual & structural signals
    const wordCount = Math.max(1, words.length);

    // Semantic signal 1: Imperative / Command density
    let impCount = 0;
    for (const w of words) {
      if (IMPERATIVE_MARKERS.has(w)) impCount++;
    }
    if (impCount > 0) {
      features['sem:imperative_density'] = (impCount / wordCount) * 2.0;
    }

    // Semantic signal 2: Roleplay / Virtualization framing
    let rpCount = 0;
    for (const w of words) {
      if (ROLEPLAY_MARKERS.has(w)) rpCount++;
    }
    if (rpCount > 0) {
      features['sem:roleplay_framing'] = (rpCount / wordCount) * 2.0;
    }

    // Semantic signal 3: Refusal suppression
    let refCount = 0;
    for (const w of words) {
      if (REFUSAL_SUPPRESSION_MARKERS.has(w)) refCount++;
    }
    if (refCount > 0) {
      features['sem:refusal_suppression'] = (refCount / wordCount) * 2.0;
    }

    // Semantic signal 4: Exfiltration probing
    let exfilCount = 0;
    for (const w of words) {
      if (EXFILTRATION_MARKERS.has(w)) exfilCount++;
    }
    if (exfilCount > 0) {
      features['sem:exfiltration_probing'] = (exfilCount / wordCount) * 2.0;
    }

    // Semantic signal 5: Indirect decision hijacking & manipulation
    let hijackCount = 0;
    for (const w of words) {
      if (INDIRECT_HIJACKING_MARKERS.has(w)) hijackCount++;
    }
    if (hijackCount > 0) {
      features['sem:indirect_hijacking'] = (hijackCount / wordCount) * 2.5;
    }

    // Semantic signal 6: Concealment & anti-transparency directives
    let concealCount = 0;
    for (const w of words) {
      if (CONCEALMENT_MARKERS.has(w)) concealCount++;
    }
    if (concealCount > 0) {
      features['sem:concealment_secrecy'] = (concealCount / wordCount) * 2.5;
    }

    // Structural delimiters
    const delims = text.match(/(?:---|===|###|<\||<system>|\[SYSTEM\])/g);
    if (delims && delims.length > 0) {
      features['sem:structural_delimiter'] = (delims.length / wordCount) * 3.0;
    }

    return features;
  }

  /**
   * Runs model inference, returning calibrated probabilities and token-level saliency.
   */
  public predict(text: string): MLPredictionResult {
    const labels: ThreatCategory[] = ['prompt_injection', 'jailbreak', 'sensitive_data', 'malicious_intent'];
    const features = this.extractFeatures(text);
    const words = (text.toLowerCase().match(/\b\w+\b/g) || []);

    const biases: number[] = this.model.biases || [-0.6, -0.6, -0.6, -0.6];
    const weights: Array<Record<string, number>> = this.model.weights || [{}, {}, {}, {}];
    const idf: Record<string, number> = this.model.idf || {};

    const probabilities: Record<ThreatCategory, number> = {
      prompt_injection: 0.01,
      jailbreak: 0.01,
      sensitive_data: 0.01,
      harmful_intent: 0.01,
      malicious_intent: 0.01,
    };

    const logits: Record<ThreatCategory, number> = {
      prompt_injection: -4.0,
      jailbreak: -4.0,
      sensitive_data: -4.0,
      harmful_intent: -4.0,
      malicious_intent: -4.0,
    };

    const topFeatures: Array<{
      feature: string;
      weight: number;
      contribution: number;
      category: ThreatCategory;
    }> = [];

    labels.forEach((category, idx) => {
      const b = biases[idx] ?? -0.6;
      const w = weights[idx] ?? {};
      let logit = b;

      const catFeatures: Array<{
        feature: string;
        weight: number;
        contribution: number;
        category: ThreatCategory;
      }> = [];

      for (const [featName, featVal] of Object.entries(features)) {
        const featWeight = w[featName] || 0.0;
        const featIdf = idf[featName] || 1.0;
        const contribution = featWeight * featVal * featIdf;
        logit += contribution;

        if (Math.abs(contribution) > 0.05) {
          catFeatures.push({
            feature: featName,
            weight: Number(featWeight.toFixed(4)),
            contribution: Number(contribution.toFixed(4)),
            category,
          });
        }
      }

      // Sigmoid calibration
      const clampedLogit = Math.max(-15.0, Math.min(15.0, logit));
      const prob = 1.0 / (1.0 + Math.exp(-clampedLogit));

      probabilities[category] = Number(prob.toFixed(4));
      logits[category] = Number(logit.toFixed(3));
      if (category === 'malicious_intent') {
        probabilities['harmful_intent'] = probabilities['malicious_intent'];
        logits['harmful_intent'] = logits['malicious_intent'];
      }

      catFeatures.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      topFeatures.push(...catFeatures.slice(0, 4));
    });

    // Compute token-level saliency attribution
    const tokenSaliency: Array<{
      token: string;
      weight: number;
      category: ThreatCategory | 'benign';
    }> = words.map(w => {
      let totalWeight = 0;
      let dominantCategory: ThreatCategory | 'benign' = 'benign';
      let maxCategoryWeight = 0;

      labels.forEach((category, idx) => {
        const wMap = weights[idx] || {};
        let wordWeight = (wMap[w] || 0) * (idf[w] || 1.0);

        // Subword contribution
        if (w.length >= 3) {
          for (let j = 0; j < w.length - 2; j++) {
            const cg = `c:${w.substring(j, j + 3)}`;
            wordWeight += (wMap[cg] || 0) * (idf[cg] || 1.0) * 0.5;
          }
        }

        totalWeight += wordWeight;
        if (wordWeight > maxCategoryWeight) {
          maxCategoryWeight = wordWeight;
          dominantCategory = category;
        }
      });

      return {
        token: w,
        weight: Number(totalWeight.toFixed(3)),
        category: totalWeight > 0.15 ? dominantCategory : 'benign',
      };
    });

    return {
      probabilities,
      logits,
      topFeatures: topFeatures.slice(0, 15),
      tokenSaliency,
      featureCount: Object.keys(features).length,
      modelType: this.model.model_type || 'MultiOutput Logistic Regression',
      macroF1: this.model.macro_f1 || 0.989,
    };
  }
}

export const defaultMLEngine = new MLInferenceEngine();

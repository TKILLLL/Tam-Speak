import { IAIGateway, UpgradedExpressionResult } from '../../domain/interfaces/IAIGateway';
import { BandScore } from '../../domain/value-objects/BandScore';

export interface UpgradeBandScoreRequest {
  sentence: string;
  currentBand?: number;
  targetBand?: number;
}

/**
 * UpgradeBandScoreUseCase
 * Transforms everyday or basic learner English sentences into Band 7.5+ / 8.5+ native phrasing
 * with idiomatic vocabulary, collocations, and natural cadence.
 */
export class UpgradeBandScoreUseCase {
  constructor(private readonly aiGateway: IAIGateway) {}

  public async execute(request: UpgradeBandScoreRequest): Promise<UpgradedExpressionResult> {
    const currentBandVo = BandScore.fromRawAverage(request.currentBand ?? 5.5);
    const targetBandVo = BandScore.fromRawAverage(request.targetBand ?? 8.0);

    return await this.aiGateway.upgradeExpression({
      sentence: request.sentence,
      currentBand: currentBandVo,
      targetBand: targetBandVo,
    });
  }
}

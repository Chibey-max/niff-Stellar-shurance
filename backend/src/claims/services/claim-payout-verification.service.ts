import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Horizon } from '@stellar/stellar-sdk';
import type { ServerApi } from '@stellar/stellar-sdk/lib/horizon/server_api';

export interface PayoutVerificationResult {
  verified: boolean;
  txHash: string;
  operationIndex?: number;
  errorReason?: string;
}

@Injectable()
export class ClaimPayoutVerificationService {
  private readonly logger = new Logger(ClaimPayoutVerificationService.name);
  private horizonClient: Horizon.Server;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const horizonUrl = this.config.get<string>('HORIZON_URL', '');
    this.horizonClient = new Horizon.Server(horizonUrl);
  }

  /**
   * Verify that a token transfer of the correct amount to the correct recipient
   * occurred on-chain via Horizon before marking claim as Paid.
   */
  async verifyTokenTransfer(
    claimId: number,
    txHash: string,
    expectedAmount: string,
    recipientAddress: string,
    tokenContractId: string,
  ): Promise<PayoutVerificationResult> {
    try {
      // Query Horizon for the transaction
      const transaction = await this.horizonClient.transactions().transaction(txHash).call();

      if (transaction.id !== txHash) {
        this.logger.warn(`Transaction hash mismatch for claim ${claimId}`);
        return {
          verified: false,
          txHash,
          errorReason: 'Transaction hash mismatch',
        };
      }

      // Find the token transfer operation
      const operationsPage = await this.horizonClient.operations().forTransaction(txHash).call();
      const operations = operationsPage.records as ServerApi.OperationRecord[];

      for (const [index, op] of operations.entries()) {
        // Check for Soroban invoke operations (token transfers are typically Soroban calls)
        if (op.type === 'invoke_host_function') {
          const invokeOp = op as ServerApi.InvokeHostFunctionOperationRecord;

          // Verify it's calling the token contract
          if (invokeOp.address === tokenContractId) {
            // Verify recipient and amount in function args
            const functionArgs = invokeOp.parameters.map((param) => param.value);

            // Check if recipient is in args (typically first or second arg)
            const recipientMatch = functionArgs.some(
              (arg) => typeof arg === 'string' && arg.includes(recipientAddress),
            );

            // Check if amount is in args
            const amountMatch = functionArgs.some(
              (arg) => typeof arg === 'string' && arg.includes(expectedAmount),
            );

            if (recipientMatch && amountMatch && invokeOp.transaction_successful) {
              this.logger.log(`Verified token transfer for claim ${claimId} at operation ${index}`);
              return {
                verified: true,
                txHash,
                operationIndex: index,
              };
            }
          }
        }

        // Also check for payment operations (for non-Soroban transfers)
        if (op.type === 'payment') {
          const paymentOp = op as ServerApi.PaymentOperationRecord;
          if (
            paymentOp.to === recipientAddress &&
            parseFloat(paymentOp.amount) === parseFloat(expectedAmount) &&
            paymentOp.transaction_successful
          ) {
            this.logger.log(`Verified payment for claim ${claimId} at operation ${index}`);
            return {
              verified: true,
              txHash,
              operationIndex: index,
            };
          }
        }
      }

      this.logger.warn(
        `No matching token transfer found for claim ${claimId} in transaction ${txHash}`,
      );
      return {
        verified: false,
        txHash,
        errorReason: 'No matching token transfer operation found',
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify token transfer for claim ${claimId}: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Log alert for verification failure (non-blocking)
      try {
        await this.logPayoutVerificationFailure(claimId, txHash, error);
      } catch (alertError) {
        this.logger.error(
          `Failed to log payout verification alert: ${alertError instanceof Error ? alertError.message : String(alertError)}`,
        );
      }

      return {
        verified: false,
        txHash,
        errorReason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Log payout verification failure for alerting (e.g., via webhook or monitoring)
   */
  private async logPayoutVerificationFailure(
    claimId: number,
    txHash: string,
    error: unknown,
  ): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Create an audit log entry
    await this.prisma.adminAuditLog.create({
      data: {
        actor: 'system',
        action: 'CLAIM_PAYOUT_VERIFICATION_FAILED',
        payload: {
          resourceType: 'CLAIM',
          resourceId: String(claimId),
          txHash,
          reason: errorMsg,
          timestamp: new Date().toISOString(),
        },
      },
    });

    this.logger.warn(`Logged payout verification failure for claim ${claimId}: ${errorMsg}`);
  }
}

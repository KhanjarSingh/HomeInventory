import crypto from 'node:crypto';
import { env } from '../../config/env';
import type { SignedUploadParamsDto, SignedUploadParamsInput } from '@home-inventory/shared';

export class UploadsService {
  /**
   * Generates signed Cloudinary upload parameters for secure direct-from-browser uploads.
   *
   * Cloudinary signing algorithm:
   * 1. Collect all parameters to sign (excluding file, api_key, resource_type, etc.).
   * 2. Sort keys alphabetically.
   * 3. Join with '=' and '&'.
   * 4. Append the api_secret.
   * 5. Generate SHA-1 hex digest.
   *
   * SECURITY INVARIANT:
   * The api_secret is strictly kept on the server and is never returned to the client.
   */
  static generateSignature(
    householdId: string,
    input?: SignedUploadParamsInput
  ): SignedUploadParamsDto {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = input?.folder || `households/${householdId}/items`;

    // Parameters to sign
    const paramsToSign: Record<string, string | number> = {
      folder,
      timestamp,
    };

    if (input?.tags && input.tags.length > 0) {
      paramsToSign.tags = input.tags.join(',');
    }

    // Sort keys alphabetically
    const sortedKeys = Object.keys(paramsToSign).sort();
    const serialized = sortedKeys.map((key) => `${key}=${paramsToSign[key]}`).join('&');

    // Sign with Cloudinary API Secret
    const stringToSign = `${serialized}${env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    return {
      signature,
      timestamp,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      folder,
    };
  }
}

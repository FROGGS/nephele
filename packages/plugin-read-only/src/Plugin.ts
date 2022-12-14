import type { Request } from 'express';
import {
  Plugin as PluginInterface,
  AuthResponse,
  UnauthorizedError,
} from 'nephele';

export type PluginConfig = {};

/**
 * Nephele read-only plugin.
 *
 * This plugin makes a path read-only.
 */
export default class Plugin implements PluginInterface {
  constructor({}: PluginConfig = {}) {}

  async beforeCheckAuthorization(
    _request: Request,
    _response: AuthResponse,
    { methodName }: { methodName: string }
  ) {
    if (
      methodName !== 'GET' &&
      methodName !== 'HEAD' &&
      methodName !== 'PROPFIND'
    ) {
      throw new UnauthorizedError('Unauthorized.');
    }
  }
}

import type {
  ClientsControllerPort,
  ClientsServicePort,
} from './clients.interfaces';
import { HttpError } from '../common/errors/http.error';

export class ClientsController implements ClientsControllerPort {
  constructor(private readonly clientsService: ClientsServicePort) {}

  providers() {
    return this.clientsService.listProviders();
  }

  async operation(provider: string, operation: string, request: Request) {
    const contentType = request.headers.get('content-type') ?? '';

    if (!contentType.toLowerCase().includes('application/json')) {
      throw new HttpError(
        400,
        'INVALID_JSON',
        'Expected application/json request body',
      );
    }

    let input: unknown;

    try {
      const text = await request.text();

      if (text.trim() === '') {
        throw new HttpError(400, 'INVALID_JSON', 'Empty JSON request body');
      }

      input = JSON.parse(text);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(400, 'INVALID_JSON', 'Malformed JSON request body');
    }

    return this.clientsService.execute(provider, operation, input);
  }
}

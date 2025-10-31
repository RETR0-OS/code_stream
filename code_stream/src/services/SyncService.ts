/**
 * SyncService - Handles all API communication with backend
 * Provides methods for CRUD operations on cells via Redis
 */

import { requestAPI } from '../handler';
import {
  ICellData,
  IPushCellResponse,
  IGetCellResponse,
  IUpdateCellResponse,
  IDeleteCellResponse,
  IGetAllCellIDsResponse,
  ITeacherServerConfig,
  IConfigResponse,
  ITestConnectionResponse
} from '../models/types';
import { logger } from '../utils/logger';

/**
 * Service for syncing cell data with backend
 */
export class SyncService {
  /**
   * Push cell content to Redis (Teacher)
   * @param hash - Session hash (6-character code)
   * @param cellData - Cell data to push
   * @returns Promise with response
   */
  public async pushCell(
    hash: string,
    cellData: ICellData
  ): Promise<IPushCellResponse> {
    try {
      const endpoint = `${hash}/push-cell/`;
      logger.debug(`Calling push-cell API - endpoint: ${endpoint}`);
      logger.debug('Cell data:', {
        cell_id: cellData.cell_id,
        cell_timestamp: cellData.cell_timestamp,
        content_length: cellData.cell_content.length
      });

      const response = await requestAPI<IPushCellResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          cell_id: cellData.cell_id,
          cell_content: cellData.cell_content,
          cell_timestamp: cellData.cell_timestamp
        })
      });

      logger.info(`Successfully pushed cell ${cellData.cell_id} to session ${hash}`);
      return response;
    } catch (error) {
      logger.error('Error pushing cell:', error);
      throw error;
    }
  }

  /**
   * Get cell content from Redis (Student)
   * @param hash - Session hash (6-character code)
   * @param cellId - Cell identifier
   * @param timestamp - Cell timestamp
   * @returns Promise with cell data
   */
  public async getCell(
    hash: string,
    cellId: string,
    timestamp: string
  ): Promise<IGetCellResponse> {
    try {
      const endpoint = `${hash}/get-cell/?cell_id=${encodeURIComponent(cellId)}&cell_timestamp=${encodeURIComponent(timestamp)}`;
      const response = await requestAPI<IGetCellResponse>(endpoint, {
        method: 'GET'
      });

      logger.debug(`Retrieved cell ${cellId} from session ${hash}`);
      return response;
    } catch (error) {
      logger.error('Error getting cell:', error);
      throw error;
    }
  }

  /**
   * Update cell content in Redis (Teacher)
   * @param hash - Session hash (6-character code)
   * @param cellData - Updated cell data
   * @returns Promise with response
   */
  public async updateCell(
    hash: string,
    cellData: ICellData
  ): Promise<IUpdateCellResponse> {
    try {
      const endpoint = `${hash}/update/`;
      const response = await requestAPI<IUpdateCellResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          cell_id: cellData.cell_id,
          cell_content: cellData.cell_content,
          cell_timestamp: cellData.cell_timestamp
        })
      });

      logger.debug(`Updated cell ${cellData.cell_id} in session ${hash}`);
      return response;
    } catch (error) {
      logger.error('Error updating cell:', error);
      throw error;
    }
  }

  /**
   * Delete cell content from Redis (Teacher)
   * @param hash - Session hash (6-character code)
   * @param cellId - Cell identifier
   * @param timestamp - Cell timestamp
   * @returns Promise with response
   */
  public async deleteCell(
    hash: string,
    cellId: string,
    timestamp: string
  ): Promise<IDeleteCellResponse> {
    try {
      const endpoint = `${hash}/delete/`;
      const response = await requestAPI<IDeleteCellResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          cell_id: cellId,
          cell_timestamp: timestamp
        })
      });

      logger.debug(`Deleted cell ${cellId} from session ${hash}`);
      return response;
    } catch (error) {
      logger.error('Error deleting cell:', error);
      throw error;
    }
  }

  /**
   * Get all available cell IDs (Student)
   * Note: Now proxied through local server to teacher server
   * @param hash - Session hash (6-character code) for session-scoped queries
   * @returns Promise with list of cell IDs
   */
  public async getAllCellIds(hash: string): Promise<IGetAllCellIDsResponse> {
    try {
      const endpoint = `${hash}/get-all-cell-ids/`;
      const response = await requestAPI<IGetAllCellIDsResponse>(endpoint, {
        method: 'GET'
      });

      logger.debug(`Retrieved all cell IDs for session ${hash}`);
      return response;
    } catch (error) {
      logger.error('Error getting all cell IDs:', error);
      throw error;
    }
  }

  /**
   * Get teacher server configuration (Student)
   * @returns Promise with config response
   */
  public async getConfig(): Promise<IConfigResponse> {
    try {
      const endpoint = `config`;
      const response = await requestAPI<IConfigResponse>(endpoint, {
        method: 'GET'
      });

      logger.debug('Retrieved config');
      return response;
    } catch (error) {
      logger.error('Error getting config:', error);
      throw error;
    }
  }

  /**
   * Set teacher server configuration (Student)
   * @param config - Teacher server configuration
   * @returns Promise with config response
   */
  public async setConfig(config: ITeacherServerConfig): Promise<IConfigResponse> {
    try {
      const endpoint = `config`;
      const response = await requestAPI<IConfigResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify(config)
      });

      logger.info('Set config successfully');
      return response;
    } catch (error) {
      logger.error('Error setting config:', error);
      throw error;
    }
  }

  /**
   * Test connection to teacher server (Student)
   * @returns Promise with test response
   */
  public async testConnection(): Promise<ITestConnectionResponse> {
    try {
      const endpoint = `test`;
      const response = await requestAPI<ITestConnectionResponse>(endpoint, {
        method: 'POST'
      });

      logger.debug('Test connection result:', response);
      return response;
    } catch (error) {
      logger.error('Error testing connection:', error);
      throw error;
    }
  }
}

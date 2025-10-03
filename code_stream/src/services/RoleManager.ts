/**
 * RoleManager - Manages user role via localStorage
 * Provides methods to get/set role and emit events on role changes
 */

import { ISignal, Signal } from '@lumino/signaling';
import { UserRole, STORAGE_KEYS, DEFAULTS } from '../models/types';

/**
 * Manages user role stored in localStorage
 */
export class RoleManager {
  private _role: UserRole;
  private _roleChanged = new Signal<this, UserRole>(this);

  /**
   * Constructor
   */
  constructor() {
    this._role = this._loadRole();
  }

  /**
   * Get current user role
   * @returns Current role ('teacher' or 'student')
   */
  public getRole(): UserRole {
    return this._role;
  }

  /**
   * Set user role and persist to localStorage
   * @param role - Role to set
   */
  public setRole(role: UserRole): void {
    if (role !== 'teacher' && role !== 'student') {
      console.warn(`Invalid role: ${role}. Must be 'teacher' or 'student'.`);
      return;
    }

    this._role = role;
    localStorage.setItem(STORAGE_KEYS.ROLE, role);
    this._roleChanged.emit(role);

    console.log(`Code Stream: Role changed to ${role}`);
  }

  /**
   * Check if current user is a teacher
   * @returns True if teacher, false otherwise
   */
  public isTeacher(): boolean {
    return this._role === 'teacher';
  }

  /**
   * Check if current user is a student
   * @returns True if student, false otherwise
   */
  public isStudent(): boolean {
    return this._role === 'student';
  }

  /**
   * Signal emitted when role changes
   */
  public get roleChanged(): ISignal<this, UserRole> {
    return this._roleChanged;
  }

  /**
   * Load role from localStorage with fallback to default
   * @private
   * @returns Loaded role or default
   */
  private _loadRole(): UserRole {
    const storedRole = localStorage.getItem(STORAGE_KEYS.ROLE);

    if (storedRole === 'teacher' || storedRole === 'student') {
      console.log(`Code Stream: Loaded role from localStorage: ${storedRole}`);
      return storedRole;
    }

    // Default to student if not set or invalid
    console.log(`Code Stream: No valid role found, defaulting to ${DEFAULTS.ROLE}`);
    localStorage.setItem(STORAGE_KEYS.ROLE, DEFAULTS.ROLE);
    return DEFAULTS.ROLE;
  }

  /**
   * Clear role from localStorage (resets to default)
   */
  public clearRole(): void {
    localStorage.removeItem(STORAGE_KEYS.ROLE);
    this._role = DEFAULTS.ROLE;
    localStorage.setItem(STORAGE_KEYS.ROLE, DEFAULTS.ROLE);
    this._roleChanged.emit(this._role);

    console.log(`Code Stream: Role cleared, reset to ${DEFAULTS.ROLE}`);
  }
}

// UUID-based ID generation for database entities
// Uses UUIDv5 (deterministic) so same content always generates same UUID

import { v5 as uuidv5 } from 'uuid';

// Base namespace for ICBINCSS (randomly generated once)
const ICBINCSS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // ISO OID namespace

// Entity-specific namespaces (derived from base namespace)
export const NAMESPACES = {
  TOKEN: uuidv5('token', ICBINCSS_NAMESPACE),
  SELECTOR: uuidv5('selector', ICBINCSS_NAMESPACE),
  LAYER: uuidv5('layer', ICBINCSS_NAMESPACE),
  STYLE: uuidv5('style', ICBINCSS_NAMESPACE),
  PROPERTY: uuidv5('property', ICBINCSS_NAMESPACE),
  FONT_FACE: uuidv5('font_face', ICBINCSS_NAMESPACE),
  KEYFRAMES: uuidv5('keyframes', ICBINCSS_NAMESPACE),
  RAW_BLOCK: uuidv5('raw_block', ICBINCSS_NAMESPACE),
  IMPORT: uuidv5('import', ICBINCSS_NAMESPACE),
  PAGE: uuidv5('page', ICBINCSS_NAMESPACE),
  COUNTER_STYLE: uuidv5('counter_style', ICBINCSS_NAMESPACE),
  FONT_FEATURE_VALUES: uuidv5('font_feature_values', ICBINCSS_NAMESPACE),
  FONT_PALETTE_VALUES: uuidv5('font_palette_values', ICBINCSS_NAMESPACE),
  STARTING_STYLE: uuidv5('starting_style', ICBINCSS_NAMESPACE),
};

/**
 * Generate deterministic UUID for a token
 * Same name always produces same UUID
 */
export function generateTokenId(name: string): string {
  return uuidv5(name, NAMESPACES.TOKEN);
}

/**
 * Generate deterministic UUID for a selector
 * Same name always produces same UUID
 */
export function generateSelectorId(name: string): string {
  return uuidv5(name, NAMESPACES.SELECTOR);
}

/**
 * Generate deterministic UUID for a layer
 * Same name always produces same UUID
 */
export function generateLayerId(name: string): string {
  return uuidv5(name, NAMESPACES.LAYER);
}

/**
 * Generate deterministic UUID for a style
 * Based on migration ID + sequence number to ensure uniqueness
 */
export function generateStyleId(migrationId: string, sequence: number): string {
  return uuidv5(`${migrationId}:${sequence}`, NAMESPACES.STYLE);
}

/**
 * Generate deterministic UUID for a custom property
 * Same name always produces same UUID
 */
export function generatePropertyId(name: string): string {
  return uuidv5(name, NAMESPACES.PROPERTY);
}

/**
 * Generate deterministic UUID for a @font-face
 * Based on family name + src to ensure uniqueness
 */
export function generateFontFaceId(family: string, src: string): string {
  return uuidv5(`${family}:${src}`, NAMESPACES.FONT_FACE);
}

/**
 * Generate deterministic UUID for @keyframes
 * Same name always produces same UUID
 */
export function generateKeyframesId(name: string): string {
  return uuidv5(name, NAMESPACES.KEYFRAMES);
}

/**
 * Generate deterministic UUID for raw CSS block
 * Based on migration ID + sequence number
 */
export function generateRawBlockId(migrationId: string, sequence: number): string {
  return uuidv5(`${migrationId}:raw:${sequence}`, NAMESPACES.RAW_BLOCK);
}

/**
 * Generate deterministic UUID for @import
 * Based on migration ID + sequence number
 */
export function generateImportId(migrationId: string, sequence: number): string {
  return uuidv5(`${migrationId}:import:${sequence}`, NAMESPACES.IMPORT);
}

/**
 * Generate deterministic UUID for @page
 * Based on pseudo selector (or 'default' if none)
 */
export function generatePageId(pseudo: string | null): string {
  return uuidv5(pseudo || 'default', NAMESPACES.PAGE);
}

/**
 * Generate deterministic UUID for @counter-style
 * Same name always produces same UUID
 */
export function generateCounterStyleId(name: string): string {
  return uuidv5(name, NAMESPACES.COUNTER_STYLE);
}

/**
 * Generate deterministic UUID for @font-feature-values
 * Based on family name
 */
export function generateFontFeatureValuesId(family: string): string {
  return uuidv5(family, NAMESPACES.FONT_FEATURE_VALUES);
}

/**
 * Generate deterministic UUID for @font-palette-values
 * Same name always produces same UUID
 */
export function generateFontPaletteValuesId(name: string): string {
  return uuidv5(name, NAMESPACES.FONT_PALETTE_VALUES);
}

/**
 * Generate deterministic UUID for @starting-style
 * Based on migration ID + sequence number
 */
export function generateStartingStyleId(migrationId: string, sequence: number): string {
  return uuidv5(`${migrationId}:starting:${sequence}`, NAMESPACES.STARTING_STYLE);
}

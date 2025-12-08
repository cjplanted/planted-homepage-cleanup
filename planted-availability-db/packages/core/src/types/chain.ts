export type ChainType = 'retail' | 'restaurant' | 'both';
export type PartnershipLevel = 'standard' | 'premium' | 'flagship';

export interface ChainContact {
  name?: string;
  email?: string;
}

export interface Chain {
  id: string;
  name: string;
  type: ChainType;
  logo_url?: string;
  website?: string;
  markets: string[]; // ISO country codes
  partnership_level?: PartnershipLevel;
  contact?: ChainContact;
}

export type CreateChainInput = Omit<Chain, 'id'>;
export type UpdateChainInput = Partial<Omit<Chain, 'id'>>;

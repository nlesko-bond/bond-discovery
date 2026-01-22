import { NextResponse } from 'next/server';
import { getConfig, saveConfig, defaultConfig } from '@/lib/config';
import { DiscoveryConfig } from '@/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Filter types enum for validation
const filterTypeEnum = z.enum([
  'search', 'facility', 'sport', 'programType', 'dateRange', 
  'age', 'gender', 'price', 'availability', 'membership'
]);

// Config validation schema
const configSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().optional(),
  organizationIds: z.array(z.string()).min(1),
  facilityIds: z.array(z.string()),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    logo: z.string().optional(),
    favicon: z.string().optional(),
    companyName: z.string().min(1),
    tagline: z.string().optional(),
  }),
  features: z.object({
    showPricing: z.boolean(),
    showAvailability: z.boolean(),
    showMembershipBadges: z.boolean(),
    showAgeGender: z.boolean(),
    enableFilters: z.array(filterTypeEnum),
    defaultView: z.enum(['programs', 'schedule']),
    allowViewToggle: z.boolean(),
  }),
  allowedParams: z.array(z.string()),
  defaultParams: z.record(z.string()),
  cacheTtl: z.number().min(60).max(3600),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const configId = searchParams.get('id') || 'default';

  try {
    const config = await getConfig(configId);
    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate the config
    const validatedConfig = configSchema.parse(body);

    // Generate ID if not provided
    const configId = validatedConfig.id || `config-${Date.now()}`;

    const config: DiscoveryConfig = {
      ...defaultConfig,
      ...validatedConfig,
      id: configId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveConfig(config);

    return NextResponse.json({ 
      data: config,
      message: 'Configuration saved successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const configId = searchParams.get('id');

  if (!configId) {
    return NextResponse.json(
      { error: 'Config ID is required' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    
    // Get existing config
    const existingConfig = await getConfig(configId);
    
    // Merge with updates
    const updatedConfig: DiscoveryConfig = {
      ...existingConfig,
      ...body,
      id: configId,
      updatedAt: new Date().toISOString(),
    };

    await saveConfig(updatedConfig);

    return NextResponse.json({ 
      data: updatedConfig,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

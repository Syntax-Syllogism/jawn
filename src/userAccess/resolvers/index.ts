import type { AccessTargetResolver, AccessTargetType } from '../types.js';
import { UserAccessError } from '../types.js';
import { fieldResolver } from './field.js';
import { objectResolver } from './object.js';

const resolvers: Record<AccessTargetType, AccessTargetResolver> = {
  field: fieldResolver,
  object: objectResolver,
};

export const getResolver = (type: string): AccessTargetResolver => {
  const resolver = resolvers[type as AccessTargetType];
  if (!resolver) throw new UserAccessError('errorUnsupportedAccessType', [type]);
  return resolver;
};

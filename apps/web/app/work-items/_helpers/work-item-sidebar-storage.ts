import { createBooleanLocalPreference } from '@/lib/local-preference/create-boolean-local-preference';

const moreFieldsPreference = createBooleanLocalPreference({
  storagePrefix: 'alice:work-item-more-fields:',
  defaultValue: false,
});

export const readMoreFieldsOpen = moreFieldsPreference.read;
export const writeMoreFieldsOpen = moreFieldsPreference.write;

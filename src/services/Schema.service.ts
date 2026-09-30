import Session, {
  AccountSession,
  InvalidCredentialError,
} from '../utils/Session';
import SchemaRepository from '../repositories/Schema.repository';

export default (session: Session) => {
  if (session.mode !== 'account')
    throw new InvalidCredentialError(
      `Invalid mode ${session.mode}`,
      'Invalid Mode'
    );
  const accountSession = session.accountSession as AccountSession;

  return {
    getById: (id: string) => {
      return SchemaRepository.getByIdAndOwner(accountSession.id, id);
    },
    list: async (page: number, limit: number) => {
      return SchemaRepository.list(accountSession.id, page, limit);
    },
    create: (name: string, description: string, schema: any) => {
      return SchemaRepository.create(
        accountSession.id,
        name,
        description,
        schema
      );
    },
    delete: async (id: string) => {
      const schema = await SchemaRepository.getByIdAndOwner(
        accountSession.id,
        id
      );

      if (!schema) return null;

      return SchemaRepository.delete(id);
    },
  };
};

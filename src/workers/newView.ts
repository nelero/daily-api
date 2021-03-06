import { Connection, DeepPartial } from 'typeorm';
import { View } from '../entity';
import { messageToJson, Worker } from './worker';

const ONE_WEEK = 604800000;

const addView = async (con: Connection, entity: View): Promise<boolean> => {
  const repo = con.getRepository(View);
  const existing = await repo.findOne({
    where: {
      userId: entity.userId,
      postId: entity.postId,
    },
    order: { timestamp: 'DESC' },
  });
  if (
    !existing ||
    entity.timestamp.getTime() - existing.timestamp.getTime() > ONE_WEEK
  ) {
    await repo.save(entity);
    return true;
  }
  return false;
};

const worker: Worker = {
  subscription: 'add-views-v2',
  handler: async (message, con, logger): Promise<void> => {
    const data: DeepPartial<View> = messageToJson(message);
    try {
      const didSave = await addView(
        con,
        con.getRepository(View).create({
          ...data,
          timestamp: data.timestamp && new Date(data.timestamp as string),
        }),
      );
      if (didSave) {
        logger.info(
          {
            view: data,
            messageId: message.id,
          },
          'added successfully view event',
        );
      } else {
        logger.debug(
          {
            view: data,
            messageId: message.id,
          },
          'ignored view event',
        );
      }
    } catch (err) {
      logger.error(
        {
          view: data,
          messageId: message.id,
          err,
        },
        'failed to add view event to db',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;

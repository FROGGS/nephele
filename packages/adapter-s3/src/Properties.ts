import type { Properties as PropertiesInterface, User } from 'nephele';
import { PropertyIsProtectedError, PropertyNotFoundError } from 'nephele';

import type { MetaStorage } from './Resource.js';
import Resource from './Resource.js';

export default class Properties implements PropertiesInterface {
  resource: Resource;

  constructor({ resource }: { resource: Resource }) {
    this.resource = resource;
  }

  async get(name: string) {
    const meta = await this.resource.getMetadata();

    switch (name) {
      case 'creationdate': {
        const lastModified =
          (await this.resource.getLastModified()) ?? new Date();
        return lastModified.toISOString();
      }
      case 'getcontentlength':
        return `${await this.resource.getLength()}`;
      case 'getcontenttype':
        const mediaType = await this.resource.getMediaType();
        if (mediaType == null) {
          throw new PropertyNotFoundError(
            `${name} property doesn't exist on resource.`,
          );
        }
        return mediaType;
      case 'getetag':
        return await this.resource.getEtag();
      case 'getlastmodified': {
        const lastModified =
          (await this.resource.getLastModified()) ?? new Date();
        return lastModified.toUTCString();
      }
      case 'resourcetype':
        if (await this.resource.isCollection()) {
          return { collection: {} };
        } else {
          return {};
        }
      case 'supportedlock':
        // This adapter supports exclusive and shared write locks.
        return {
          lockentry: [
            {
              lockscope: { exclusive: {} },
              locktype: { write: {} },
            },
            {
              lockscope: { shared: {} },
              locktype: { write: {} },
            },
          ],
        };
    }

    if (meta.props == null || !(name in meta.props)) {
      throw new PropertyNotFoundError(
        `${name} property doesn't exist on resource.`,
      );
    }

    return meta.props[name];
  }

  async getByUser(name: string, _user: User) {
    return await this.get(name);
  }

  async set(name: string, value: string) {
    const errors = await this.runInstructions([['set', name, value]]);

    if (errors != null && errors.length) {
      throw errors[0][1];
    }
  }

  async setByUser(name: string, value: string, user: User) {
    const errors = await this.runInstructionsByUser(
      [['set', name, value]],
      user,
    );

    if (errors != null && errors.length) {
      throw errors[0][1];
    }
  }

  async remove(name: string) {
    const errors = await this.runInstructions([['remove', name, undefined]]);

    if (errors != null && errors.length) {
      throw errors[0][1];
    }
  }

  async removeByUser(name: string, user: User) {
    const errors = await this.runInstructionsByUser(
      [['remove', name, undefined]],
      user,
    );

    if (errors != null && errors.length) {
      throw errors[0][1];
    }
  }

  async runInstructions(instructions: ['set' | 'remove', string, any][]) {
    let meta: MetaStorage = {};
    let changed = false;
    let errors: [string, Error][] = [];

    const errorEverything = (e: Error) => {
      const errProps: { [k: string]: Error } = {};
      for (let instruction of instructions) {
        errProps[instruction[1]] = e;
      }
      return Object.entries(errProps);
    };

    try {
      meta = await this.resource.getMetadata();
    } catch (e: any) {
      return errorEverything(e);
    }

    for (let instruction of instructions) {
      const [action, name, value] = instruction;

      if (
        [
          'creationdate',
          'getcontentlength',
          'getcontenttype',
          'getetag',
          'getlastmodified',
          'resourcetype',
          'supportedlock',
        ].includes(name)
      ) {
        errors.push([
          name,
          new PropertyIsProtectedError(`${name} is a protected property.`),
        ]);
        continue;
      }

      if (action === 'set') {
        if (meta.props == null) {
          meta.props = {};
        }

        meta.props[name] = value;
        changed = true;
      } else {
        if (meta.props != null && name in meta.props) {
          delete meta.props[name];
          changed = true;
        }
      }
    }

    if (errors.length) {
      return errors;
    }

    if (changed) {
      try {
        await this.resource.saveMetadata(meta);
      } catch (e: any) {
        return errorEverything(e);
      }
    }

    if (errors.length) {
      return errors;
    }
  }

  async runInstructionsByUser(
    instructions: ['set' | 'remove', string, any][],
    _user: User,
  ) {
    return await this.runInstructions(instructions);
  }

  async getAll() {
    const meta = await this.resource.getMetadata();
    const props = { ...meta.props };

    for (let name of [
      'creationdate',
      'getcontentlength',
      'getcontenttype',
      'getetag',
      'getlastmodified',
      'resourcetype',
      'supportedlock',
    ]) {
      try {
        props[name] = await this.get(name);
      } catch (e: any) {
        if (!(e instanceof PropertyNotFoundError)) {
          props[name] = e;
        }
      }
    }

    return props;
  }

  async getAllByUser(_user: User) {
    return await this.getAll();
  }

  async list() {
    return [...(await this.listLive()), ...(await this.listDead())];
  }

  async listByUser(user: User) {
    return [
      ...(await this.listLiveByUser(user)),
      ...(await this.listDeadByUser(user)),
    ];
  }

  async listLive() {
    return [
      'creationdate',
      'getcontentlength',
      'getcontenttype',
      'getetag',
      'getlastmodified',
      'resourcetype',
      'supportedlock',
    ];
  }

  async listLiveByUser(_user: User) {
    return await this.listLive();
  }

  async listDead() {
    let meta = await this.resource.getMetadata();

    return [
      // TODO: Should these be included if they're not defined yet.
      // 'displayname',
      // 'getcontentlanguage',
      ...Object.keys(meta.props || {}),
    ];
  }

  async listDeadByUser(_user: User) {
    return await this.listDead();
  }
}

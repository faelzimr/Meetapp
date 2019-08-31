import * as Yup from 'yup';
import { Op } from 'sequelize';
import { startOfHour, parseISO, isBefore, parseISO,startOfDay,endOfDay } from 'date-fns';
import Meetup from '../models/Meetup';
import File from '../models/File';
import User from '../models/User';

class MeetupController {
  async index(req, res) {
    const where = {};
    const { page = 1 } = req.query;

    if (req.query.date) {
      const searchDate = parseISO(req.query.date);

      where.date = {
        [Op.between]: [startOfDay(searchDate), endOfDay(searchDate)],
      };
    }

    const meetups = await Meetup.findAll({
      where,
      limit: 10,
      offset: (page - 1) * 10,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    return res.json(meetups);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string().required(),
      description: Yup.string().required(),
      location: Yup.string().required(),
      date: Yup.date().required(),
      file_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validations fails' });
    }

    const { title, description, location, date, file_id } = req.body;

    /**
     * Check if exist file_id
     */

    const existsFile = await File.findOne({
      where: { id: file_id },
    });

    if (!existsFile) {
      return res.status(401).json({ error: 'File no exist' });
    }

    /**
     * Check for past dates
     */

    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past dates are not permitted' });
    }

    /**
     * Check date availability
     */

    const checkAvailability = await Meetup.findOne({
      where: {
        user_id: req.userId,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res.status(400).json({ error: 'Meetup date is not available' });
    }

    const meetup = await Meetup.create({
      user_id: req.userId,
      title,
      description,
      location,
      date,
      file_id,
    });

    return res.json(meetup);
  }

  async update(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string(),
      description: Yup.string(),
      location: Yup.string(),
      date: Yup.date(),
      file_id: Yup.number(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validations fails' });
    }

    const { date, file_id } = req.body;

    /**
     * Check if exist file_id
     */
    if (file_id) {
      const existsFile = await File.findOne({
        where: { id: file_id },
      });

      if (!existsFile) {
        return res.status(401).json({ error: 'File no exist' });
      }
    }

    /**
     * Check for past dates
     */
    if (date) {
      const hourStart = startOfHour(parseISO(date));

      if (isBefore(hourStart, new Date())) {
        return res.status(400).json({ error: 'Past dates are not permitted' });
      }
      /**
       * Check date availability
       */

      const checkAvailability = await Meetup.findOne({
        where: {
          user_id: req.userId,
          date: hourStart,
        },
      });

      if (checkAvailability) {
        return res.status(400).json({ error: 'Meetup date is not available' });
      }
    }

    /**
     * Check user is organizator
     */

    const checkIsOrganizator = await Meetup.findOne({
      where: {
        id: req.params.id,
        user_id: req.userId,
      },
    });

    if (!checkIsOrganizator) {
      return res
        .status(400)
        .json({ error: 'User is not the organizator of meetup' });
    }

    /**
     * Check if is past date the meetup
     */

    const meetup = await Meetup.findByPk(req.params.id);

    if (isBefore(meetup.date, new Date())) {
      return res
        .status(400)
        .json({ error: 'the meetup has already taken place' });
    }

    await meetup.update(req.body);

    return res.json(meetup);
  }

  async delete(req, res) {
    const meetup = await Meetup.findByPk(req.params.id);

    if (meetup.user_id !== req.userId) {
      return res
        .status(400)
        .json({ error: 'User is not the organizator of meetup' });
    }

    if (isBefore(meetup.date, new Date())) {
      return res
        .status(400)
        .json({ error: 'the meetup has already taken place' });
    }

    await meetup.destroy();

    return res.send();
  }
}

export default new MeetupController();

import * as Yup from 'yup';
import { Op } from 'sequelize';
import { isBefore } from 'date-fns';
import Subscription from '../models/Subscription';
import Meetup from '../models/Meetup';
import User from '../models/User';

import SubscriptionMail from '../jobs/SubscriptionMain';
import Queue from '../../lib/Queue';

class SubscriptionController {
  async index(req, res) {
    const subscriptions = await Subscription.findAll({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          where: {
            date: {
              [Op.gt]: new Date(),
            },
          },
          required: true,
        },
      ],
      order: [[Meetup, 'date']],
    });

    return res.json(subscriptions);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      meetup_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validations fails' });
    }

    const { meetup_id } = req.body;

    const user_id = req.userId;

    /**
     * Check if user is organizator of meetup
     */

    const meetup = await Meetup.findByPk(meetup_id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
      ],
    });

    if (meetup.user_id === user_id) {
      return res.status(400).json({ error: 'User is organizator of meetup' });
    }

    /**
     * Check if the Meetup has already occurred
     */

    if (isBefore(meetup.date, new Date())) {
      return res.status(400).json({ error: 'Meetup has already occurred' });
    }

    /**
     * Check if the user has already subscribed
     */

    const checkUserSubscribed = await Subscription.findOne({
      where: { meetup_id, user_id },
    });

    if (checkUserSubscribed) {
      return res.status(400).json({ error: 'User has already subscribed' });
    }

    /**
     * Check subscribe to two meetups at the same time
     */

    const checkDate = await Subscription.findOne({
      where: {
        user_id,
      },
      include: [
        {
          model: Meetup,
          as: 'meetup',
          required: true,
          where: {
            date: meetup.date,
          },
        },
      ],
    });

    if (checkDate) {
      return res
        .status(400)
        .json({ error: "Can't subscribe to two meetups at the same time" });
    }

    const { name: userName, email: userEmail } = await User.findByPk(user_id);

    const subscription = await Subscription.create({
      user_id,
      meetup_id,
    });

    await Queue.add(SubscriptionMail.key, {
      meetup,
      userName,
      userEmail,
    });

    return res.json(subscription);
  }
}

export default new SubscriptionController();

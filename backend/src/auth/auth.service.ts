import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../user/model/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';


@Injectable()
export class AuthService {
    constructor(@InjectModel(User.name) private readonly userModel: Model<User>) { }

    async register(name: string, email: string, password: string) {
        const user = await this.userModel.findOne({ email });
        if (user) {
            throw new BadRequestException('Bu email ilə istifadəçi artıq mövcuddur');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        return await this.userModel.create({ name, email, password: hashedPassword });
    }



    async login(email: string, password: string) {
        const user = await this.userModel.findOne({ email });
        if (!user) {
            throw new NotFoundException('İstifadəçi tapılmadı');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new BadRequestException('Şifrə yanlışdır');
        }

        const token = jwt.sign({ _id: user._id, email: user.email }, "inventory_ai_auditor_secret_key", { expiresIn: '8h' });
        return { user, token };
    }

}
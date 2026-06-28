import { Controller, Delete, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  /**
   * GET /user/last-comparison/:userId
   * İstifadəçinin sonuncu cədvəl qarşılaşdırma nəticəsini qaytarır.
   * Dashboard card-larında dəqiqlik və fərqliliklər göstərmək üçün istifadə olunur.
   */
  @Get('last-comparison/:userId')
  async getLastComparison(@Param('userId') userId: string) {
    return await this.userService.getLastComparisonStats(userId);
  }

  @Delete(':id')
  async deleteAnalysis(@Param('id') id: string) {
    return await this.userService.deleteAnalysis(id);
  }
}

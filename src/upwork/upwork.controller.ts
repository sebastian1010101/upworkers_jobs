import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { UpworkService } from './upwork.service';

const searchSchema = z.object({
  query: z.string().trim().min(2).max(200),
  limit: z.number().int().min(1).max(20).default(10),
}).strict();

@Controller('upwork/jobs')
export class UpworkController {
  constructor(private readonly upwork: UpworkService) {}

  @Post('search')
  search(@Body() body: unknown) {
    return this.upwork.search(...this.parse(body));
  }

  @Post('import')
  import(@Body() body: unknown) {
    return this.upwork.import(...this.parse(body));
  }

  private parse(body: unknown): [string, number] {
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })));
    }
    return [parsed.data.query, parsed.data.limit];
  }
}

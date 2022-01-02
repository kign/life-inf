#define C4WA_MM_FIXED
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "life-inf.h"

extern void init () {
#ifdef C4WA
    printf("Box0 = %d, Box = %d, ratio = %.4f\n", sizeof(struct Box0), sizeof(struct Box), 1.0*sizeof(struct Box)/sizeof(struct Box0));
    mm_init(RESERVED_REGION, max(sizeof(struct Box0), sizeof(struct Box)));
#endif

    char * initial_pos = "........."
                         ".....x..."
                         "...xxx..."
                         "....x...."
                         ".........";
    const int sX = 9;
    const int sY = 5;
    assert(sX * sY == strlen(initial_pos));

    set_region(0, 0, sX, sY, initial_pos);
/*

    life_prepare();

    int iter;
    for (iter = 0; iter < 1000; iter ++) {
        const int cycle = life_step();

        if (cycle) {
            printf("Cycle detected at iter = %d\n", iter);
            break;
        }
    }
*/

/*
    printf("Successfully completed %d iterations: cnt = %d, age = %d, env = %d %d %d %d\n", iter,
            stat_i.count, get_current_age(), stat_i.xmin, stat_i.xmax, stat_i.ymin, stat_i.ymax);
*/
}

#ifndef C4WA
int main () {
    init();
    return 0;
}
#endif
#ifndef _LIFE_INF_H_
#define _LIFE_INF_H_

#define assert(x) if(!(x)) { printf("‼️ ASSERTION: \"" #x "\" @ line %d\n", __LINE__); abort (); }

#define N 5
#define N0 5

#define RESERVED_REGION 10000

struct Box0 {
    int level;
    int x0, y0, size, age;
    char cells0[2 * N0 * N0];
};

struct Box {
    int level;
    int x0, y0, size, age;
    struct Box * cells[N * N];
};

struct Stat {
    unsigned int hash;
    int count;
    int xmin, xmax, ymin, ymax;
};

// board.c
extern struct Box * get_world();
extern int get_cell(int x, int y, int plane);
extern void release_box(struct Box * box);
extern void set_cell(int x, int y, int val, int plane);
extern void set_region(int x0, int y0, int sX, int sY, char * src);
extern int get_active_plane();
extern void set_active_plane(int new_active_plane);
extern void set_envelope(int xmin, int xmax, int ymin, int ymax);
extern void increment_age ();
extern int get_current_age ();

// life-inf.c
extern void life_prepare ();
extern int life_step ();

#ifndef C4WA
#define min(a,b) ((a) < (b))?(a):(b)
#define max(a,b) ((a) < (b))?(b):(a)
#endif

#endif // _LIFE_INF_H_